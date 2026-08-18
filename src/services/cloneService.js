import { ChannelType, PermissionFlagsBits } from "discord.js";

export function createCloneService() {
  async function cloneCategory(guild, categoryId) {
    const source = await guild.channels.fetch(categoryId).catch(() => null);
    if (!source || source.type !== ChannelType.GuildCategory) throw new Error("유효한 카테고리 ID가 아닙니다.");
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!source.viewable || !me || !source.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) throw new Error("카테고리를 복제할 권한이 없습니다.");

    const overwrite = (channel) => channel.permissionOverwrites?.cache.map((item) => ({ id: item.id, allow: item.allow.bitfield, deny: item.deny.bitfield, type: item.type })) || [];
    const clone = await guild.channels.create({
      name: `${source.name} 복제`,
      type: ChannelType.GuildCategory,
      position: source.rawPosition + 1,
      permissionOverwrites: overwrite(source)
    });
    const children = [...source.children.cache.values()].sort((a, b) => a.rawPosition - b.rawPosition);
    for (const channel of children) {
      const options = { name: channel.name, type: channel.type, parent: clone.id, permissionOverwrites: overwrite(channel) };
      if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement || channel.type === ChannelType.GuildForum || channel.type === ChannelType.GuildMedia) {
        if (channel.topic) options.topic = channel.topic;
        options.nsfw = Boolean(channel.nsfw);
        options.rateLimitPerUser = channel.rateLimitPerUser || 0;
      }
      if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
        options.bitrate = channel.bitrate;
        options.userLimit = channel.userLimit || 0;
        options.rtcRegion = channel.rtcRegion || undefined;
        options.videoQualityMode = channel.videoQualityMode || undefined;
      }
      await guild.channels.create(options);
    }
    return { category: clone, count: children.length };
  }
  async function deleteCategory(guild, categoryId) {
    const category = await guild.channels.fetch(categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("유효한 카테고리 ID가 아닙니다.");
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me || !category.permissionsFor(me)?.has(PermissionFlagsBits.ManageChannels)) throw new Error("카테고리를 삭제할 권한이 없습니다.");
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    const children = [...channels.values()].filter((channel) => channel?.parentId === category.id).sort((a, b) => b.rawPosition - a.rawPosition);
    for (const channel of children) {
      await channel.delete("카테고리 삭제 명령어");
    }
    await category.delete("카테고리 삭제 명령어");
    return { categoryName: category.name, count: children.length };
  }

  return { cloneCategory, deleteCategory };
}
