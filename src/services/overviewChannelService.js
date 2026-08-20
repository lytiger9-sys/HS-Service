import { ChannelType, PermissionFlagsBits } from "discord.js";

const CATEGORY_NAME = "개요";
const CHANNEL_DEFINITIONS = [
  { key: "members", prefix: "인원수", unit: "명" },
  { key: "bots", prefix: "봇 수", unit: "개" },
  { key: "total", prefix: "전체 인원 수", unit: "명" }
];

function channelName(prefix, value, unit = "명") {
  return `${prefix}: ${value}${unit}`;
}

function findManagedChannel(category, prefix) {
  return category.children.cache.find((channel) => channel.type === ChannelType.GuildVoice && channel.name.startsWith(`${prefix}:`));
}

export function createOverviewChannelService(context) {
  async function getOrCreateCategory(guild) {
    let category = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === CATEGORY_NAME
    );

    if (!category) {
      category = await guild.channels.create({
        name: CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        position: 0,
        reason: "개요 통계 카테고리 생성"
      });
    }

    await category.setPosition(0).catch(() => null);
    return category;
  }

  async function getCounts(guild) {
    const fetchedMembers = await guild.members.fetch({ force: true }).catch(() => guild.members.cache);
    const members = [...fetchedMembers.values()];
    const selfId = context.client?.user?.id;
    const countedMembers = members.filter((member) => member.id !== selfId);
    const botCount = members.filter((member) => member.user.bot).length;
    return {
      members: countedMembers.filter((member) => !member.user.bot).length,
      bots: botCount,
      total: countedMembers.length
    };
  }

  async function syncGuild(guild) {
    if (!guild) return null;
    const category = await getOrCreateCategory(guild);
    const counts = await getCounts(guild);
    const permissionOverwrites = [
      {
        id: guild.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream]
      }
    ];

    const channels = {};
    for (const definition of CHANNEL_DEFINITIONS) {
      let channel = findManagedChannel(category, definition.prefix);
      if (!channel) {
        channel = await guild.channels.create({
          name: channelName(definition.prefix, counts[definition.key], definition.unit),
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites,
          reason: "개요 실시간 통계 음성 채널 생성"
        });
      } else {
        if (channel.parentId !== category.id) {
          await channel.setParent(category.id, { lockPermissions: false }).catch(() => null);
        }
        await channel.permissionOverwrites.set(permissionOverwrites, "개요 음성 채널 권한 동기화").catch(() => null);
        const nextName = channelName(definition.prefix, counts[definition.key], definition.unit);
        if (channel.name !== nextName) {
          await channel.setName(nextName, "개요 실시간 통계 갱신").catch(() => null);
        }
      }
      channels[definition.key] = channel.id;
    }

    return { categoryId: category.id, channels, counts };
  }

  async function syncGuildById(guildId) {
    const guild = context.client?.guilds.cache.get(guildId) || await context.client?.guilds.fetch(guildId).catch(() => null);
    return syncGuild(guild);
  }

  return { syncGuild, syncGuildById };
}
