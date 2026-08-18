import { ChannelType } from "discord.js";
import { normalizeTicketSettings } from "../../src/shared/ticket.js";
import { planHasFeature, planAllowsFeatureToggle } from "../../src/shared/planAccess.js";
import { getPlanDefinition } from "../../src/config/plans.js";
import { getBotManagedRoles } from "../../src/services/nicknameService.js";

function formatDate(value) {
  if (!value) {
    return "없음";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("ko-KR");
}

function channelOption(channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    parentId: channel.parentId || "",
    label: `#${channel.name}`
  };
}

function roleOption(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.hexColor,
    label: role.name
  };
}

function groupChannels(guild) {
  const channels = [...guild.channels.cache.values()];

  return {
    text: channels
      .filter((channel) => channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)
      .sort((left, right) => left.position - right.position)
      .map(channelOption),
    categories: channels
      .filter((channel) => channel.type === ChannelType.GuildCategory)
      .sort((left, right) => left.position - right.position)
      .map(channelOption),
    voice: channels
      .filter((channel) => channel.type === ChannelType.GuildVoice)
      .sort((left, right) => left.position - right.position)
      .map(channelOption)
  };
}

function buildSections() {
  return [
    { id: "overview", label: "개요", description: "서버 상태" },
    { id: "administrators", label: "관리자", description: "계정 및 출퇴근" },
    { id: "welcome", label: "환영", description: "신규 멤버" },
    { id: "ticket", label: "티켓", description: "봇 전용 문의" },
    { id: "security", label: "보안", description: "차단 규칙" },
    { id: "assignment", label: "할당", description: "메시지 역할" },
    { id: "voice", label: "음성", description: "임시 채널" },
    { id: "embed", label: "임베드", description: "임베드 및 공지" },
    { id: "polls", label: "투표", description: "버튼 투표" },
    { id: "logs", label: "로그", description: "채널 연결" },
    { id: "partner", label: "파트너", description: "제휴 신청 및 채널" },
    { id: "nickname", label: "닉네임", description: "역할별 이름 규칙" }
  ];
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

export async function buildDashboardViewModel(context, guild, planId = "enterprise") {
  const [overview, settings, notes, polls, tempChannels, stalePartners] = await Promise.all([
    context.services.serverInfo.getDashboardSnapshot(guild),
    context.services.settings.getSettings(guild.id),
    context.services.notes.listNotes(guild.id),
    context.services.polls.listPolls(guild.id),
    context.services.tempChannels.listTempChannels(guild.id),
    context.services.partners.listStale(guild.id)
  ]);

  const administrators = (overview.administrators || []).filter((admin) => !admin.isBot);
  const staffSettings = normalizeStaffSettings(settings.staff);
  const ticketSettings = normalizeTicketSettings(settings.ticket);
  const staffStatusMap = staffSettings.statuses || {};

  const staffMembers = administrators.map((admin) => {
    const status = staffStatusMap[admin.id] || {};
    return {
      ...admin,
      isOnDuty: Boolean(status.isOnDuty),
      statusUpdatedAt: status.updatedAt || null
    };
  });

  const staffCounts = {
    onDuty: staffMembers.filter((member) => member.isOnDuty).length,
    offDuty: staffMembers.filter((member) => !member.isOnDuty).length
  };

  const dashboardOverview = {
    ...overview,
    adminCount: administrators.length,
    administrators
  };

  const normalizedSettings = {
    ...settings,
    staff: staffSettings,
    ticket: ticketSettings,
    nickname: {
      enabled: true,
      rules: {},
      ...(settings.nickname || {})
    },
    embed: {
      enabled: true,
      mode: "components",
      channelId: "",
      title: "서버 공지",
      description: "공지사항이 아직 설정되지 않았습니다.",
      color: "#1a1d23",
      footer: "",
      authorName: "",
      authorUrl: "",
      thumbnailUrl: "",
      imageUrl: "",
      fields: [],
      componentsBody: "",
      mentionEveryone: false,
      mentionHere: false,
      mentionRoleIds: [],
      scheduleEnabled: false,
      scheduleIntervalMinutes: 60,
      lastSentAt: null,
      ...(settings.embed || {})
    }
  };

  const groupedChannels = groupChannels(guild);
  const roles = getBotManagedRoles(guild).map(roleOption);

  return {
    botName: context.config.botName,
    guild,
    sections: buildSections().filter((section) => planHasFeature(planId, section.id)),
    activeSection: "overview",
    plan: getPlanDefinition(planId),
    planId,
    allowFeatureToggle: planAllowsFeatureToggle(planId),
    overview: dashboardOverview,
    administrators,
    adminCount: administrators.length,
    settings: normalizedSettings,
    notes,
    polls,
    tempChannels,
    stalePartners,
    staffMembers,
    staffCounts,
    channels: groupedChannels,
    roles,
    formatDate,
    query: guild.id
  };
}
