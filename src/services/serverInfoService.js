import { PermissionFlagsBits } from "discord.js";
import { buildServerInfoEmbed } from "../shared/embeds.js";

function sortMembersByJoinDate(members) {
  return [...members.values()]
    .filter((member) => member.joinedTimestamp)
    .sort((left, right) => right.joinedTimestamp - left.joinedTimestamp);
}

function formatAdministrator(member) {
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

export function createServerInfoService(context, guildState) {
  async function getOverview(guild) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    const memberList = sortMembersByJoinDate(members);
    const humans = memberList.filter((member) => !member.user.bot).length;
    const bots = memberList.filter((member) => member.user.bot).length;
    const administrators = memberList
      .filter((member) => member.permissions.has(PermissionFlagsBits.Administrator))
      .map(formatAdministrator);
    const owner = await guild.fetchOwner().catch(() => null);

    return {
      totalMembers: memberList.length || guild.memberCount,
      humans,
      bots,
      adminCount: administrators.length,
      administrators,
      channels: guild.channels.cache.size,
      roles: guild.roles.cache.size,
      ownerTag: owner?.user?.tag ?? "",
      joinOrder: memberList
    };
  }

  async function buildInfoEmbed(guild) {
    const stats = await getOverview(guild);
    return buildServerInfoEmbed(guild, stats);
  }

  async function getJoinOrder(guild, limit = 20) {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    return sortMembersByJoinDate(members).slice(0, limit).map((member, index) => ({
      rank: index + 1,
      user: member.user,
      joinedTimestamp: member.joinedTimestamp
    }));
  }

  async function getDashboardSnapshot(guild) {
    const state = context.store.snapshotGuild(guild.id);
    const overview = await getOverview(guild);

    return {
      guild,
      ...overview,
      recentNotes: state?.notes?.slice(0, 5) ?? [],
      recentPunishments: state?.punishments?.slice(0, 5) ?? [],
      activePolls: Object.values(state?.polls ?? {}).filter((poll) => poll.messageId),
      activeTickets: Object.values(state?.tickets ?? {}).filter((ticket) => ticket.status === "open"),
      tempChannels: Object.values(state?.tempChannels ?? {})
    };
  }

  return {
    getOverview,
    buildInfoEmbed,
    getJoinOrder,
    getDashboardSnapshot
  };
}
