import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits
} from "discord.js";
import { buildBaseEmbed, palette } from "../shared/embeds.js";
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

function buildCloseButton(channelId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${channelId}`)
      .setLabel("티켓 닫기")
      .setStyle(ButtonStyle.Danger)
  );
}

export function createTicketService(context, guildState) {
  async function getOpenTicketByUser(guildId, userId) {
    await guildState.ensure(guildId);
    const guild = guildState.snapshot(guildId);
    return Object.values(guild.tickets).find((ticket) => ticket.userId === userId && ticket.status === "open") ?? null;
  }

  async function openTicket({ guild, member, openedBy = null, reason = "ticket-open" }) {
    const settings = (await context.services.settings.getSettings(guild.id)).ticket;
    if (!settings.enabled) {
      throw new Error("티켓 기능이 비활성화되어 있습니다.");
    }

    const existing = await getOpenTicketByUser(guild.id, member.id);
    if (existing) {
      const existingChannel = await guild.channels.fetch(existing.channelId).catch(() => null);
      if (existingChannel) {
        return { channel: existingChannel, existing: true };
      }
    }

    const categoryId = settings.categoryId || null;
    const channelName = `${settings.channelPrefix || "ticket-"}${slugifyDiscordName(member.user.username, member.user.id)}`;
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: categoryId,
      topic: `티켓 담당: ${member.user.tag}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: member.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        },
        {
          id: guild.members.me?.id ?? context.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });

    await channel.permissionOverwrites.create(guild.roles.everyone.id, {
      ViewChannel: false
    }).catch(() => null);

    const ticketRecord = {
      channelId: channel.id,
      userId: member.id,
      userTag: member.user.tag,
      createdAt: new Date().toISOString(),
      status: "open",
      openedBy: openedBy?.id ?? member.id,
      openedByTag: openedBy?.user?.tag ?? member.user.tag,
      closedBy: null,
      closedAt: null,
      reason
    };

    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tickets[channel.id] = ticketRecord;
      return ticketRecord;
    });

    await channel.send({
      embeds: [
        buildBaseEmbed({
          title: "티켓이 개설되었습니다.",
          description: "관리자가 확인한 뒤 답변합니다. 닫기 버튼은 관리자만 사용할 수 있습니다.",
          color: palette.accent,
          fields: [
            { name: "요청자", value: `${member.user.tag}`, inline: true },
            { name: "카테고리", value: settings.categoryId ? `<#${settings.categoryId}>` : "미설정", inline: true }
          ],
          timestamp: Date.now()
        })
      ],
      components: [buildCloseButton(channel.id)]
    });

    await context.services.logs.sendLogByKey(guild.id, "ticketChannelId", {
      embeds: [
        buildBaseEmbed({
          title: "티켓 개설",
          description: `${member.user.tag} 이(가) 티켓을 열었습니다.`,
          color: palette.success,
          fields: [
            { name: "채널", value: `<#${channel.id}>`, inline: true },
            { name: "개설자", value: openedBy?.user?.tag ?? member.user.tag, inline: true },
            { name: "사유", value: reason, inline: false }
          ],
          timestamp: Date.now()
        })
      ]
    });

    return { channel, existing: false };
  }

  async function closeTicket({ guild, channel, closedBy, reason = "ticket-close" }) {
    await guildState.ensure(guild.id);
    const ticket = guildState.snapshot(guild.id).tickets[channel.id];
    if (!ticket || ticket.status !== "open") {
      throw new Error("이 채널은 활성 티켓이 아닙니다.");
    }

    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tickets[channel.id] = {
        ...ticket,
        status: "closed",
        closedAt: new Date().toISOString(),
        closedBy: closedBy?.id ?? null,
        closeReason: reason
      };
      return guildStateValue.tickets[channel.id];
    });

    await channel.permissionOverwrites.edit(ticket.userId, {
      SendMessages: false,
      ViewChannel: true,
      ReadMessageHistory: true
    }).catch(() => null);

    await channel.edit({
      name: `closed-${slugifyDiscordName(ticket.userTag || channel.name, channel.name)}`.slice(0, 100)
    }).catch(() => null);

    await channel.send({
      embeds: [
        buildBaseEmbed({
          title: "티켓이 닫혔습니다.",
          description: closedBy ? `닫은 사람: ${closedBy.user.tag}` : "관리자에 의해 닫혔습니다.",
          color: palette.danger,
          timestamp: Date.now()
        })
      ]
    }).catch(() => null);

    await context.services.logs.sendLogByKey(guild.id, "ticketChannelId", {
      embeds: [
        buildBaseEmbed({
          title: "티켓 종료",
          description: `${ticket.userTag} 의 티켓이 닫혔습니다.`,
          color: palette.danger,
          fields: [
            { name: "채널", value: `<#${channel.id}>`, inline: true },
            { name: "닫은 사람", value: closedBy?.user?.tag ?? "알 수 없음", inline: true }
          ],
          timestamp: Date.now()
        })
      ]
    });

    return ticket;
  }

  async function listTickets(guildId) {
    await guildState.ensure(guildId);
    return Object.values(guildState.snapshot(guildId).tickets).slice();
  }

  return {
    getOpenTicketByUser,
    openTicket,
    closeTicket,
    listTickets
  };
}
