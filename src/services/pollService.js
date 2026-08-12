import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} from "discord.js";
import { randomUUID } from "node:crypto";
import { buildPollEmbed, createBaseEmbed, palette } from "../shared/embeds.js";
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
    .filter(Boolean)
    .slice(0, 5);

  if (normalized.length < 2) {
    throw new Error("투표 항목은 최소 2개 이상이어야 합니다.");
  }

  if (options.filter((label) => String(label ?? "").trim()).length > 5) {
    throw new Error("투표 항목은 최대 5개까지 지원합니다.");
  }

  return normalized.map((label) => ({
    label: clampText(label, 60),
    count: 0
  }));
}

function buildPollComponents(poll) {
  const buttons = poll.options.map((option, index) => {
    const isFreeText = poll.freeTextEnabled && index === poll.options.length - 1;
    const label = isFreeText
      ? `${option.label} (${option.count})`
      : `${option.label} (${option.count})`;

    return new ButtonBuilder()
      .setCustomId(isFreeText ? `poll:${poll.id}:free` : `poll:${poll.id}:vote:${index}`)
      .setLabel(clampText(label, 80))
      .setStyle(isFreeText ? ButtonStyle.Secondary : ButtonStyle.Primary);
  });

  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }
  return rows;
}

function applyVote(poll, user, optionIndex, freeText = "") {
  const existing = poll.votes[user.id];
  const previousOptionIndex = existing?.optionIndex ?? null;
  const previousWasFree = Boolean(existing?.freeText);

  if (previousOptionIndex != null && previousOptionIndex !== optionIndex) {
    poll.options[previousOptionIndex].count = Math.max(0, poll.options[previousOptionIndex].count - 1);
  }

  const isFreeText = poll.freeTextEnabled && optionIndex === poll.options.length - 1;
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

    const message = await channel.send({
      embeds: [buildPollEmbed(poll)],
      components: buildPollComponents(poll)
    });

    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.polls[pollId].channelId = channel.id;
      guildStateValue.polls[pollId].messageId = message.id;
      return guildStateValue.polls[pollId];
    });

    await context.services.logs.sendLogByKey(guildId, "voteChannelId", {
      embeds: [
        createBaseEmbed({
          title: "투표 게시",
          description: `${poll.question} 을(를) ${channel.id ? `<#${channel.id}>` : "채널"} 에 게시했습니다.`,
          color: palette.success,
          timestamp: Date.now()
        })
      ]
    });

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

    return message.edit({
      embeds: [buildPollEmbed(poll)],
      components: buildPollComponents(poll)
    });
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

    const optionIndex = poll.options.length - 1;
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
    buildPollComponents
  };
}
