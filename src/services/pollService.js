import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder
} from "discord.js";
import { randomUUID } from "node:crypto";

import { clampText } from "../shared/naming.js";

async function resolveTextChannel(guild, channelId) {
  if (!channelId) {
    return null;
  }

  const cached = guild.channels.cache.get(channelId);
  if (cached?.isTextBased?.()) {
    return cached;
  }

  const fetched = await guild.channels.fetch(channelId).catch(() => null);
  return fetched?.isTextBased?.() ? fetched : null;
}

function normalizeOptions(options, freeTextEnabled) {
  const normalized = options
    .map((label) => String(label ?? "").trim())
    .filter(Boolean);
  const maxChoices = freeTextEnabled ? 4 : 5;
  if (normalized.length < 2) throw new Error("투표 항목은 최소 2개 이상이어야 합니다.");
  if (normalized.length > maxChoices) throw new Error(`투표 항목은 ${maxChoices}개까지 지원합니다.`);

  const result = normalized.slice(0, maxChoices).map((label) => ({
    label: clampText(label, 60),
    count: 0,
    isFreeText: false
  }));
  if (freeTextEnabled) result.push({ label: "자유 입력", count: 0, isFreeText: true });
  return result;
}

function buildPollComponents(poll) {
  const showResults = poll.resultVisibility !== "private" || poll.expired;
  const buttons = poll.options.map((option, index) => {
    const suffix = showResults ? ` (${option.count})` : "";
    const label = clampText(`${option.label}${suffix}`, 80);
    return new ButtonBuilder()
      .setCustomId(option.isFreeText ? `poll:${poll.id}:free` : `poll:${poll.id}:vote:${index}`)
      .setLabel(label)
      .setStyle(option.isFreeText ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(Boolean(poll.expired));
  });

  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }
  return rows;
}

function buildPollPayload(poll) {
  const container = new ContainerBuilder();
  const status = poll.expired ? "투표 종료" : (poll.resultVisibility === "private" ? "결과 비공개" : "실시간 결과 공개");
  const expiry = poll.expiresAt ? `\n상태: ${status} · 만료: <t:${Math.floor(new Date(poll.expiresAt).getTime() / 1000)}:f>` : `\n상태: ${status}`;
  const heading = `## ${poll.question}${poll.description ? `\n${poll.description}` : ""}${expiry}`;
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(heading));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  return { flags: MessageFlags.IsComponentsV2, components: [container, ...buildPollComponents(poll)] };
}

function applyVote(poll, user, optionIndex, freeText = "") {
  const existing = poll.votes[user.id];
  const previousOptionIndex = existing?.optionIndex ?? null;
  const previousWasFree = Boolean(existing?.freeText);

  if (previousOptionIndex != null && previousOptionIndex !== optionIndex) {
    poll.options[previousOptionIndex].count = Math.max(0, poll.options[previousOptionIndex].count - 1);
  }

  const isFreeText = Boolean(poll.options[optionIndex]?.isFreeText);
  if (previousOptionIndex == null || previousOptionIndex !== optionIndex) {
    poll.options[optionIndex].count += 1;
  }

  if (previousWasFree) {
    poll.freeTextAnswers = poll.freeTextAnswers.filter((answer) => answer.userId !== user.id);
  }

  const voteRecord = {
    optionIndex,
    freeText: isFreeText ? String(freeText ?? "").trim() : "",
    userTag: user.tag,
    votedAt: new Date().toISOString()
  };

  poll.votes[user.id] = voteRecord;
  if (isFreeText) {
    if (!voteRecord.freeText) {
      throw new Error("자유 입력 답변은 비어 있을 수 없습니다.");
    }

    poll.freeTextAnswers ??= [];
    poll.freeTextAnswers.push({
      userId: user.id,
      userTag: user.tag,
      value: voteRecord.freeText,
      createdAt: voteRecord.votedAt
    });
  }
}

export function createPollService(context, guildState) {
  async function createPoll(guildId, payload) {
    const settings = await context.services.settings.getSettings(guildId);
    if (settings.polls?.enabled === false) {
      throw new Error("현재 투표 기능이 꺼져 있습니다.");
    }

    const question = String(payload.question ?? "").trim();
    if (!question) {
      throw new Error("투표 질문을 입력해야 합니다.");
    }

    const poll = {
      id: randomUUID(),
      guildId,
      channelId: payload.channelId || "",
      messageId: "",
      question: clampText(question, 120),
      description: clampText(payload.description || "", 1200),
      options: normalizeOptions(payload.options || [], Boolean(payload.freeTextEnabled)),
      freeTextEnabled: Boolean(payload.freeTextEnabled),
      resultVisibility: payload.resultVisibility === "private" ? "private" : "public",
      expirationDays: Math.max(1, Math.min(365, Number(payload.expirationDays) || 7)),
      expiresAt: new Date(Date.now() + Math.max(1, Math.min(365, Number(payload.expirationDays) || 7)) * 86400000).toISOString(),
      expired: false,
      logMessageId: "",
      votes: {},
      freeTextAnswers: [],
      createdAt: new Date().toISOString(),
      createdBy: payload.createdBy || "",
      createdByTag: payload.createdByTag || ""
    };

    await guildState.patch(guildId, (guild) => {
      guild.polls[poll.id] = poll;
      return poll;
    });

    return poll;
  }

  async function getPoll(guildId, pollId) {
    await guildState.ensure(guildId);
    return guildState.snapshot(guildId).polls[pollId] ?? null;
  }

  async function listPolls(guildId) {
    await guildState.ensure(guildId);
    return Object.values(guildState.snapshot(guildId).polls);
  }

  async function publishPoll(guildId, pollId, channelId = null) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error("서버를 찾을 수 없습니다.");
    }

    const settings = await context.services.settings.getSettings(guildId);
    if (settings.polls?.enabled === false) {
      throw new Error("현재 투표 기능이 꺼져 있습니다.");
    }

    const poll = await getPoll(guildId, pollId);
    if (!poll) {
      throw new Error("투표를 찾을 수 없습니다.");
    }

    const channel = await resolveTextChannel(guild, channelId || poll.channelId);
    if (!channel) {
      throw new Error("투표를 보낼 채널을 찾을 수 없습니다.");
    }

    const message = await channel.send(buildPollPayload(poll));

    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.polls[pollId].channelId = channel.id;
      guildStateValue.polls[pollId].messageId = message.id;
      return guildStateValue.polls[pollId];
    });

    const logMessage = await context.services.logs.sendLogByKey(guildId, "voteChannelId", {
      ...buildPollLogPayload(poll, "투표 진행 중")
    });
    if (logMessage) {
      await guildState.patch(guildId, (guildStateValue) => {
        guildStateValue.polls[pollId].logMessageId = logMessage.id;
        return guildStateValue.polls[pollId];
      });
    }

    return message;
  }

  async function syncPollMessage(guildId, pollId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const poll = await getPoll(guildId, pollId);
    if (!poll || !poll.channelId || !poll.messageId) {
      return null;
    }

    const channel = await resolveTextChannel(guild, poll.channelId);
    if (!channel) {
      return null;
    }

    const message = await channel.messages.fetch(poll.messageId).catch(() => null);
    if (!message) {
      return null;
    }

    const messageResult = await message.edit(buildPollPayload(poll));
    await syncPollLog(guildId, pollId, poll);
    return messageResult;
  }

  function buildPollLogPayload(poll, status = "투표 진행 중") {
    const total = poll.options.reduce((sum, option) => sum + Number(option.count || 0), 0);
    const lines = poll.options.map((option) => `${option.label}: ${option.count}표`).join("\n");
    const container = new ContainerBuilder();
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `## 투표 결과 · ${status}`,
      `**${poll.question}**`,
      poll.description || "",
      "",
      lines,
      `총 투표 수: ${total}명`
    ].filter(Boolean).join("\n")));
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    const stopButton = new ButtonBuilder()
      .setCustomId(`poll:stop:${poll.id}`)
      .setLabel(poll.expired ? "투표 종료됨" : "투표 즉시 중지")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(Boolean(poll.expired));
    return {
      flags: MessageFlags.IsComponentsV2,
      components: [container, new ActionRowBuilder().addComponents(stopButton)]
    };
  }

  async function syncPollLog(guildId, pollId, poll = null) {
    const current = poll || await getPoll(guildId, pollId);
    if (!current) return null;
    if (current.logMessageId) {
      const edited = await context.services.logs.editLogByKey(guildId, "voteChannelId", current.logMessageId, buildPollLogPayload(current, current.expired ? "투표 종료" : "투표 진행 중"));
      if (edited) return edited;
    }
    const sent = await context.services.logs.sendLogByKey(guildId, "voteChannelId", buildPollLogPayload(current, current.expired ? "투표 종료" : "투표 진행 중"));
    if (sent) {
      await guildState.patch(guildId, (guild) => { guild.polls[pollId].logMessageId = sent.id; return guild.polls[pollId]; });
    }
    return sent;
  }

  async function stopPoll(guildId, pollId) {
    const poll = await getPoll(guildId, pollId);
    if (!poll) throw new Error("투표를 찾을 수 없습니다.");
    if (!poll.expired) {
      await guildState.patch(guildId, (guild) => { guild.polls[pollId].expired = true; return guild.polls[pollId]; });
      await syncPollMessage(guildId, pollId);
      await syncPollLog(guildId, pollId);
    }
    return getPoll(guildId, pollId);
  }

  async function republishPoll(guildId, pollId) {
    const poll = await getPoll(guildId, pollId);
    if (!poll) throw new Error("투표를 찾을 수 없습니다.");
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    const channel = guild && await resolveTextChannel(guild, poll.channelId);
    if (!channel) throw new Error("투표를 게시할 채널을 찾을 수 없습니다.");
    if (poll.messageId) await channel.messages.delete(poll.messageId).catch(() => null);
    await guildState.patch(guildId, (state) => { state.polls[pollId].messageId = ""; state.polls[pollId].expired = false; state.polls[pollId].expiresAt = new Date(Date.now() + Math.max(1, Number(state.polls[pollId].expirationDays) || 7) * 86400000).toISOString(); return state.polls[pollId]; });
    return publishPoll(guildId, pollId, channel.id);
  }

  async function deletePoll(guildId, pollId) {
    const poll = await getPoll(guildId, pollId);
    if (!poll) throw new Error("투표를 찾을 수 없습니다.");
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (guild && poll.channelId && poll.messageId) {
      const channel = await resolveTextChannel(guild, poll.channelId);
      await channel?.messages.delete(poll.messageId).catch(() => null);
    }
    if (guild && poll.logMessageId) {
      await context.services.logs.editLogByKey(guildId, "voteChannelId", poll.logMessageId, { components: [] }).catch(() => null);
    }
    await guildState.patch(guildId, (state) => { delete state.polls[pollId]; return state.polls; });
    return true;
  }

  async function expirePoll(guildId, pollId) {
    const poll = await getPoll(guildId, pollId);
    if (!poll || poll.expired || !poll.expiresAt || Date.parse(poll.expiresAt) > Date.now()) return false;
    await guildState.patch(guildId, (guild) => { guild.polls[pollId].expired = true; return guild.polls[pollId]; });
    await syncPollMessage(guildId, pollId);
    await syncPollLog(guildId, pollId);
    return true;
  }

  async function processExpirations() {
    for (const guild of context.client?.guilds.cache.values() || []) {
      const polls = await listPolls(guild.id);
      for (const poll of polls) await expirePoll(guild.id, poll.id).catch(() => null);
    }
  }

  async function vote(guildId, pollId, user, optionIndex, freeText = "") {
    const settings = await context.services.settings.getSettings(guildId);
    if (settings.polls?.enabled === false) {
      throw new Error("현재 투표 기능이 꺼져 있습니다.");
    }

    await guildState.patch(guildId, (guild) => {
      const poll = guild.polls[pollId];
      if (!poll) {
        throw new Error("투표를 찾을 수 없습니다.");
      }
      if (poll.expired || (poll.expiresAt && Date.parse(poll.expiresAt) <= Date.now())) {
        poll.expired = true;
        throw new Error("이미 만료된 투표입니다.");
      }

      applyVote(poll, user, optionIndex, freeText);
      return poll;
    });

    await syncPollMessage(guildId, pollId);
  }

  async function handleFreeTextVote(interaction, pollId, value) {
    const poll = await getPoll(interaction.guildId, pollId);
    if (!poll) {
      throw new Error("투표를 찾을 수 없습니다.");
    }

    const optionIndex = poll.options.findIndex((option) => option.isFreeText);
    if (optionIndex < 0) throw new Error("이 투표에는 자유 입력 항목이 없습니다.");
    await vote(interaction.guildId, pollId, interaction.user, optionIndex, value);
  }

  async function handleChoiceVote(interaction, pollId, optionIndex) {
    await vote(interaction.guildId, pollId, interaction.user, optionIndex);
  }

  return {
    createPoll,
    getPoll,
    listPolls,
    publishPoll,
    syncPollMessage,
    vote,
    handleFreeTextVote,
    handleChoiceVote,
    buildPollComponents,
    processExpirations,
    stopPoll,
    republishPoll,
    deletePoll
  };
}
