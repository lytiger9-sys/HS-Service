import { ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } from "discord.js";
import { palette } from "../shared/embeds.js";
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

function sortMembersByJoinDate(members) {
  return [...members.values()]
    .filter((member) => member.joinedTimestamp)
    .sort((left, right) => right.joinedTimestamp - left.joinedTimestamp);
}

function formatMember(member) {
  return {
    id: member.id,
    mention: `<@${member.id}>`,
    tag: member.user.tag,
    displayName: member.displayName || member.user.globalName || member.user.username,
    username: member.user.username,
    avatarUrl: member.user.displayAvatarURL({ size: 128 }),
    highestRole: member.roles.highest?.name || "역할 없음",
    joinedTimestamp: member.joinedTimestamp ?? null,
    isBot: member.user.bot
  };
}

function formatRosterGroup(members, emptyText) {
  if (!members.length) {
    return emptyText;
  }

  const visible = members.slice(0, 12).map((member) => `• ${member.mention || member.tag || member.displayName}`);
  if (members.length > 12) {
    visible.push(`• 외 ${members.length - 12}명`);
  }

  return visible.join("\n");
}

function textDisplay(content) {
  return {
    type: 10,
    content: clampText(content, 4000)
  };
}

function separator() {
  return {
    type: 14,
    divider: true
  };
}

function normalizeStaffSettings(settings = {}) {
  return {
    enabled: true,
    channelId: "",
    messageId: "",
    embedTitle: "관리자 출퇴근 상태",
    embedDescription: "버튼을 눌러 출퇴근 상태를 변경합니다.",
    buttonLabel: "출퇴근",
    statuses: {},
    ...(settings || {}),
    statuses: {
      ...((settings && settings.statuses) || {})
    }
  };
}

function buildStatusPayload(guild, settings, staffMembers) {
  const onDuty = staffMembers.filter((member) => member.isOnDuty);
  const offDuty = staffMembers.filter((member) => !member.isOnDuty);
  const toggleButton = new ButtonBuilder()
    .setCustomId("staff:toggle")
    .setLabel(clampText(settings.buttonLabel || "출퇴근", 80))
    .setStyle(ButtonStyle.Primary)
    .toJSON();

  const summary = [
    `**출근 중**: ${onDuty.length}명`,
    `**퇴근 중**: ${offDuty.length}명`
  ].join("\n");

  const rosterBlock = [
    `**출근 중 목록**`,
    formatRosterGroup(onDuty, "출근 중인 관리자가 없습니다."),
    "",
    `**퇴근 중 목록**`,
    formatRosterGroup(offDuty, "퇴근 중인 관리자가 없습니다.")
  ].join("\n");

  const footer = `> ${guild.name} · 마지막 갱신: <t:${Math.floor(Date.now() / 1000)}:R>`;

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [
      {
        type: 17,
        accentColor: palette.info,
        components: [
          textDisplay(`## ${clampText(settings.embedTitle || "관리자 출퇴근 상태", 256)}\n${clampText(settings.embedDescription || "버튼을 눌러 출퇴근 상태를 변경합니다.", 4000)}`),
          separator(),
          {
            type: 9,
            components: [textDisplay(summary)],
            accessory: toggleButton
          },
          separator(),
          textDisplay(rosterBlock),
          separator(),
          textDisplay(footer)
        ]
      }
    ]
  };
}

export function createStaffService(context, guildState) {
  async function buildRoster(guild, staffSettings = null) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    const settings = normalizeStaffSettings(
      staffSettings || (await context.services.settings.getSettings(guild.id)).staff
    );
    if (settings.enabled === false) {
      return [];
    }
    const statusMap = settings.statuses && typeof settings.statuses === "object" ? settings.statuses : {};

    return sortMembersByJoinDate(members)
      .filter((member) => member.permissions.has(PermissionFlagsBits.Administrator) && !member.user.bot)
      .map((member) => {
        const status = statusMap[member.id] || {};
        const isOnDuty = Boolean(status.isOnDuty);

        return {
          ...formatMember(member),
          isOnDuty,
          statusUpdatedAt: status.updatedAt || null
        };
      });
  }

  async function publishBoard(guildId, targetChannelId = "") {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      throw new Error("서버를 찾을 수 없습니다.");
    }

    const settings = normalizeStaffSettings((await context.services.settings.getSettings(guildId)).staff);
    if (settings.enabled === false) {
      throw new Error("현재 스태프 기능이 꺼져 있습니다.");
    }
    const channelId = targetChannelId || settings.channelId;
    const channel = await resolveTextChannel(guild, channelId);
    if (!channel) {
      throw new Error("스태프 상태를 게시할 채널을 찾을 수 없습니다.");
    }

    const roster = await buildRoster(guild, settings);
    const payload = buildStatusPayload(guild, settings, roster);
    const storedMessageId = settings.messageId || "";

    if (storedMessageId) {
      const existing = await channel.messages.fetch(storedMessageId).catch(() => null);
      if (existing) {
        await existing.edit(payload).catch(() => null);
        return existing;
      }
    }

    const message = await channel.send(payload).catch(() => null);
    if (!message) {
      throw new Error("스태프 상태를 게시하지 못했습니다.");
    }

    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.settings.staff = normalizeStaffSettings(guildStateValue.settings.staff);
      guildStateValue.settings.staff.channelId = channel.id;
      guildStateValue.settings.staff.messageId = message.id;
      return guildStateValue.settings.staff;
    });

    return message;
  }

  async function syncStaffBoard(guildId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const settings = normalizeStaffSettings((await context.services.settings.getSettings(guildId)).staff);
    if (settings.enabled === false) {
      return null;
    }
    if (!settings.channelId) {
      return null;
    }

    const channel = await resolveTextChannel(guild, settings.channelId);
    if (!channel) {
      return null;
    }

    const roster = await buildRoster(guild, settings);
    const payload = buildStatusPayload(guild, settings, roster);
    const storedMessageId = settings.messageId || "";

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
      guildStateValue.settings.staff = normalizeStaffSettings(guildStateValue.settings.staff);
      guildStateValue.settings.staff.channelId = channel.id;
      guildStateValue.settings.staff.messageId = message.id;
      return guildStateValue.settings.staff;
    });

    return message;
  }

  async function toggleStatus(guildId, member) {
    const guild = member.guild || (await context.client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      throw new Error("서버를 찾을 수 없습니다.");
    }

    const settings = normalizeStaffSettings((await context.services.settings.getSettings(guildId)).staff);
    if (settings.enabled === false) {
      throw new Error("현재 스태프 기능이 꺼져 있습니다.");
    }

    if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new Error("관리자만 출퇴근 상태를 변경할 수 있습니다.");
    }

    let nextStatus = false;
    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.settings.staff = normalizeStaffSettings(guildStateValue.settings.staff);
      guildStateValue.settings.staff.statuses ??= {};
      const current = guildStateValue.settings.staff.statuses[member.id]?.isOnDuty ?? false;
      nextStatus = !current;
      guildStateValue.settings.staff.statuses[member.id] = {
        isOnDuty: nextStatus,
        updatedAt: new Date().toISOString(),
        updatedById: member.id,
        updatedByTag: member.user.tag
      };
      return guildStateValue.settings.staff.statuses[member.id];
    });

    await syncStaffBoard(guildId);

    return {
      isOnDuty: nextStatus,
      label: nextStatus ? "출근" : "퇴근"
    };
  }

  return {
    buildRoster,
    publishBoard,
    syncStaffBoard,
    toggleStatus
  };
}
