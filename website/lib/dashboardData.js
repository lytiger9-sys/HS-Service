import { ChannelType } from "discord.js";

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
      .filter((channel) =>
        channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement
      )
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
    { id: "administrators", label: "관리자", description: "권한 계정" },
    { id: "welcome", label: "환영", description: "신규 멤버" },
    { id: "ticket", label: "티켓", description: "문의 채널" },
    { id: "security", label: "보안", description: "타임아웃 규칙" },
    { id: "assignment", label: "역할", description: "메시지 역할" },
    { id: "voice", label: "음성", description: "임시 채널" },
    { id: "honeypot", label: "허니팟", description: "추방 감시" },
    { id: "notice", label: "공지", description: "서버 안내" },
    { id: "polls", label: "투표", description: "버튼 투표" },
    { id: "logs", label: "로그", description: "채널 연결" }
  ];
}

export async function buildDashboardViewModel(context, guild) {
  const [overview, settings, notes, polls, tempChannels] = await Promise.all([
    context.services.serverInfo.getDashboardSnapshot(guild),
    context.services.settings.getSettings(guild.id),
    context.services.notes.listNotes(guild.id),
    context.services.polls.listPolls(guild.id),
    context.services.tempChannels.listTempChannels(guild.id)
  ]);

  const administrators = (overview.administrators || []).filter((admin) => !admin.isBot);
  const dashboardOverview = {
    ...overview,
    adminCount: administrators.length,
    administrators
  };

  const groupedChannels = groupChannels(guild);
  const roles = [...guild.roles.cache.values()]
    .filter((role) => role.id !== guild.id)
    .sort((left, right) => right.position - left.position)
    .map(roleOption);

  return {
    botName: context.config.botName,
    guild,
    sections: buildSections(),
    activeSection: "overview",
    overview: dashboardOverview,
    administrators,
    adminCount: administrators.length,
    settings,
    notes,
    polls,
    tempChannels,
    channels: groupedChannels,
    roles,
    formatDate,
    query: guild.id
  };
}
