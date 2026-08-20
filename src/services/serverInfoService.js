import { ChannelType, PermissionFlagsBits } from "discord.js";
import { buildServerInfoComponents } from "../shared/embeds.js";

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
    const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    const allMembers = [...members.values()];
    const memberList = sortMembersByJoinDate(members);
    const selfId = context.client?.user?.id;
    const botMemberPresent = allMembers.some((member) => member.id === selfId);
    const countedMembers = allMembers.filter((member) => member.id !== selfId);
    const humans = countedMembers.filter((member) => !member.user.bot).length;
    const bots = allMembers.filter((member) => member.user.bot).length;
    const administrators = allMembers
      .filter((member) => member.permissions.has(PermissionFlagsBits.Administrator))
      .map(formatAdministrator);
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    const countableChannels = [...channels.values()].filter((channel) => channel.type !== ChannelType.GuildCategory && !channel.isThread?.());
    const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
    const owner = await guild.fetchOwner().catch(() => null);

    return {
      totalMembers: Math.max(0, Number(guild.memberCount || allMembers.length) - (botMemberPresent ? 1 : 0)),
      humans,
      bots,
      adminCount: administrators.length,
      administrators,
      channels: countableChannels.length,
      roles: roles.size,
      ownerTag: owner?.user?.tag ?? "",
      joinOrder: memberList
    };
  }

  async function buildInfoEmbed(guild) {
    const stats = await getOverview(guild);
    return buildServerInfoComponents(guild, stats);
  }

  async function getJoinOrder(guild) {
    const members = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    return sortMembersByJoinDate(members).map((member, index) => ({
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
      recentPunishments: state?.punishments?.slice(0, 5) ?? [],
      activePolls: Object.values(state?.polls ?? {}).filter((poll) => poll.messageId),
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
