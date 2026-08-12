import { ChannelType, PermissionFlagsBits } from "discord.js";
import {
  buildTicketBoardPayload,
  buildTicketChannelPayload,
  buildTicketCancelNoticePayload,
  buildTicketClosePromptPayload,
  buildTicketClosedNoticePayload,
  buildTicketQuestionModal,
  buildTicketAnswersFromInteraction,
  buildTicketCategoryMenuPayload,
  getTicketChannelName,
  normalizeTicketSettings
} from "../shared/ticket.js";
import { slugifyDiscordName } from "../shared/naming.js";

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

function findOpenTicket(guildState, guildId, userId) {
  const guild = guildState.snapshot(guildId);
  return Object.values(guild?.tickets ?? {}).find((ticket) => ticket.status === "open" && ticket.userId === userId) || null;
}

function getTicketRecord(guildState, guildId, channelId) {
  const guild = guildState.snapshot(guildId);
  return guild?.tickets?.[channelId] || null;
}

function getTicketSettings(settings) {
  return normalizeTicketSettings(settings?.ticket || {});
}

export function createTicketService(context, guildState) {
  async function getSettings(guildId) {
    const settings = await context.services.settings.getSettings(guildId);
    return getTicketSettings(settings);
  }

  async function getCategory(guildId, categoryId) {
    const settings = await getSettings(guildId);
    return settings.categories.find((category) => category.id === categoryId) || null;
  }

  async function getOpenTicketByUser(guildId, userId) {
    await guildState.ensure(guildId);
    return findOpenTicket(guildState, guildId, userId);
  }

  async function isBotTicketChannel(guildId, channelId) {
    await guildState.ensure(guildId);
    const ticket = getTicketRecord(guildState, guildId, channelId);
    return Boolean(ticket && ticket.status === "open" && ticket.source === "bot");
  }

  async function syncBoard(guildId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const settings = await getSettings(guildId);
    if (settings.enabled === false) {
      return null;
    }
    const channel = await resolveTextChannel(guild, settings.board.channelId);
    if (!channel) {
      return null;
    }

    const payload = buildTicketBoardPayload(guild.name, settings);
    const storedMessageId = settings.board.messageId || "";

    if (storedMessageId) {
      const existing = await channel.messages.fetch(storedMessageId).catch(() => null);
      if (existing) {
        await existing.edit(payload).catch(() => null);
        return existing;
      }
    }

    const message = await channel.send(payload).catch(() => null);
    if (!message) {
      return null;
    }

    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.settings.ticket ??= {};
      guildStateValue.settings.ticket.board ??= {};
      guildStateValue.settings.ticket.board.channelId = channel.id;
      guildStateValue.settings.ticket.board.messageId = message.id;
      return guildStateValue.settings.ticket.board;
    });

    return message;
  }

  async function openTicket({ guild, member, categoryId, answers = [], requestedBy = null }) {
    const settings = await getSettings(guild.id);
    if (settings.enabled === false) {
      throw new Error("현재 티켓 기능이 꺼져 있습니다.");
    }
    const category = settings.categories.find((entry) => entry.id === categoryId) || null;
    if (!category) {
      throw new Error("선택한 티켓 카테고리를 찾을 수 없습니다.");
    }

    const existing = await getOpenTicketByUser(guild.id, member.id);
    if (existing) {
      const existingChannel = await guild.channels.fetch(existing.channelId).catch(() => null);
      if (existingChannel) {
        return { channel: existingChannel, existing: true, ticket: existing };
      }
    }

    const channelName = getTicketChannelName(category, member);
    const parentId = category.serverCategoryId || null;
    const botMemberId = guild.members.me?.id || context.client.user.id;

    const channel = await guild.channels.create({
      name: slugifyDiscordName(channelName, "ticket"),
      type: ChannelType.GuildText,
      parent: parentId,
      topic: `티켓 요청자: ${member.user.tag} / 카테고리: ${category.label}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: botMemberId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        }
      ]
    });

    const requester = {
      id: member.id,
      tag: member.user.tag,
      mention: `<@${member.id}>`
    };

    const ticketRecord = {
      channelId: channel.id,
      categoryId: category.id,
      categoryLabel: category.label,
      userId: member.id,
      userTag: member.user.tag,
      userMention: requester.mention,
      requestedById: requestedBy?.id || member.id,
      requestedByTag: requestedBy?.user?.tag || member.user.tag,
      answers,
      createdAt: new Date().toISOString(),
      status: "open",
      source: "bot",
      closingAt: null,
      closedAt: null,
      closedById: null,
      closedByTag: null
    };

    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tickets[channel.id] = ticketRecord;
      return ticketRecord;
    });

    const payload = buildTicketChannelPayload({
      guildName: guild.name,
      requester,
      category,
      answers,
      channelId: channel.id,
      createdAt: ticketRecord.createdAt
    });

    await channel.send(payload);

    return { channel, existing: false, ticket: ticketRecord };
  }

  async function beginClosePrompt({ guild, channel, requestedBy, ephemeral = true }) {
    const ticket = await guildState.ensure(guild.id).then(() => getTicketRecord(guildState, guild.id, channel.id));
    if (!ticket || ticket.status !== "open") {
      throw new Error("열려 있는 봇 티켓이 아닙니다.");
    }

    const settings = await getSettings(guild.id);
    if (settings.enabled === false) {
      throw new Error("현재 티켓 기능이 꺼져 있습니다.");
    }

    if (!requestedBy?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
      throw new Error("관리자만 티켓을 닫을 수 있습니다.");
    }

    return buildTicketClosePromptPayload({
      channelName: channel.id,
      requestedByTag: requestedBy.user?.tag || requestedBy.tag || "관리자",
      ephemeral
    });
  }

  async function confirmClose({ guild, channel, closedBy }) {
    const ticket = await guildState.ensure(guild.id).then(() => getTicketRecord(guildState, guild.id, channel.id));
    if (!ticket || ticket.status !== "open") {
      throw new Error("열려 있는 봇 티켓이 아닙니다.");
    }

    const settings = await getSettings(guild.id);
    if (settings.enabled === false) {
      throw new Error("현재 티켓 기능이 꺼져 있습니다.");
    }

    if (!closedBy?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
      throw new Error("관리자만 티켓을 닫을 수 있습니다.");
    }

    const closingAt = new Date().toISOString();
    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tickets[channel.id] = {
        ...ticket,
        status: "closing",
        closingAt,
        closedById: closedBy.id,
        closedByTag: closedBy.user?.tag || closedBy.tag || ""
      };
      return guildStateValue.tickets[channel.id];
    });

    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false,
      ViewChannel: true,
      ReadMessageHistory: true
    }).catch(() => null);

    await channel.send(buildTicketClosedNoticePayload()).catch(() => null);

    const ticketLabel = ticket.categoryLabel || ticket.userTag || channel.name;
    await channel.edit({
      name: slugifyDiscordName(`closed-${ticketLabel}`, channel.name)
    }).catch(() => null);

    setTimeout(async () => {
      await channel.delete(`티켓 삭제 확정: ${closedBy.user?.tag || closedBy.tag || closedBy.id}`).catch(() => null);
    }, 10000);

    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tickets[channel.id] = {
        ...guildStateValue.tickets[channel.id],
        status: "closed",
        closedAt: new Date().toISOString()
      };
      return guildStateValue.tickets[channel.id];
    });

    return ticket;
  }

  async function cancelClosePrompt() {
    return buildTicketCancelNoticePayload();
  }

  async function handleCloseShortcut(message) {
    const content = String(message.content || "").trim();
    if (!content.startsWith("!티켓닫기")) {
      return false;
    }

    if (!message.guild || !message.channel?.isTextBased?.()) {
      return false;
    }

    const ticket = await guildState.ensure(message.guild.id).then(() => getTicketRecord(guildState, message.guild.id, message.channel.id));
    if (!ticket || ticket.status !== "open") {
      return false;
    }

    const settings = await getSettings(message.guild.id);
    if (settings.enabled === false) {
      return false;
    }

    if (!message.member?.permissions?.has?.(PermissionFlagsBits.Administrator)) {
      await message.reply({ content: "관리자만 티켓을 닫을 수 있습니다." }).catch(() => null);
      return true;
    }

    const prompt = await beginClosePrompt({
      guild: message.guild,
      channel: message.channel,
      requestedBy: message.member,
      ephemeral: false
    });

    await message.channel.send(prompt).catch(() => null);
    return true;
  }

  async function buildCategoryMenu(guildId) {
    const settings = await getSettings(guildId);
    if (settings.enabled === false) {
      return {
        content: "현재 티켓 기능이 꺼져 있습니다.",
        ephemeral: true
      };
    }
    return buildTicketCategoryMenuPayload(settings);
  }

  async function buildModalForCategory(guildId, categoryId) {
    const category = await getCategory(guildId, categoryId);
    if (!category) {
      throw new Error("선택한 티켓 카테고리를 찾을 수 없습니다.");
    }

    return buildTicketQuestionModal(category);
  }

  async function openTicketFromModal(interaction, categoryId) {
    const guild = interaction.guild;
    if (!guild) {
      throw new Error("서버에서만 사용할 수 있습니다.");
    }

    const category = await getCategory(guild.id, categoryId);
    if (!category) {
      throw new Error("선택한 티켓 카테고리를 찾을 수 없습니다.");
    }

    const answers = buildTicketAnswersFromInteraction(interaction, category);
    return openTicket({
      guild,
      member: interaction.member,
      categoryId: category.id,
      answers,
      requestedBy: interaction.member
    });
  }

  return {
    getSettings,
    getCategory,
    getOpenTicketByUser,
    isBotTicketChannel,
    syncBoard,
    openTicket,
    beginClosePrompt,
    confirmClose,
    cancelClosePrompt,
    handleCloseShortcut,
    buildCategoryMenu,
    buildModalForCategory,
    openTicketFromModal
  };
}
