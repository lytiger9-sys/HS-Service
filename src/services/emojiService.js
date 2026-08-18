import { PermissionFlagsBits } from "discord.js";

const MAX_BYTES = 256 * 1024;

export function createEmojiService(context) {
  async function importFromSource(targetGuild, sourceGuildId, sourceEmojiId, userId) {
    const me = targetGuild.members.me || await targetGuild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) throw new Error("봇에게 이모지 생성 권한이 없습니다.");
    const sourceGuild = context.client.guilds.cache.get(sourceGuildId) || await context.client.guilds.fetch(sourceGuildId).catch(() => null);
    if (!sourceGuild) throw new Error("원본 서버를 찾을 수 없습니다.");
    const sourceEmoji = await sourceGuild.emojis.fetch(sourceEmojiId).catch(() => null);
    if (!sourceEmoji) throw new Error("원본 이모지를 찾을 수 없습니다.");
    await targetGuild.emojis.fetch();
    if (targetGuild.emojis.cache.some((emoji) => emoji.name === sourceEmoji.name)) throw new Error(`이미 같은 이름의 이모지 '${sourceEmoji.name}'가 있습니다.`);
    const imageUrl = sourceEmoji.imageURL({ extension: sourceEmoji.animated ? "gif" : "png", size: 256 });
    if (!imageUrl) throw new Error("원본 이모지 이미지를 찾을 수 없습니다.");
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error("원본 이모지 이미지를 가져오지 못했습니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error("이모지 이미지가 너무 큽니다.");
    const created = await targetGuild.emojis.create({ attachment: buffer, name: sourceEmoji.name, reason: `이모지 스틸: ${userId}` });
    await context.services.guildState.patch(targetGuild.id, (state) => {
      state.expressions ??= { emojis: [], sounds: [] };
      state.expressions.emojis ??= [];
      state.expressions.emojis.push({ id: created.id, name: created.name, sourceGuildId, sourceId: sourceEmoji.id, createdBy: userId, createdAt: new Date().toISOString() });
      state.expressions.emojis = state.expressions.emojis.slice(-100);
    });
    return created;
  }

  async function list(guild) {
    await guild.emojis.fetch();
    return [...guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function remove(guild, emojiId, member) {
    if (!member?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) throw new Error("이모지 관리 권한이 필요합니다.");
    const emoji = await guild.emojis.fetch(emojiId).catch(() => null);
    if (!emoji) throw new Error("해당 이모지를 찾을 수 없습니다.");
    await emoji.delete("이모지 스틸 관리자가 삭제");
    await context.services.guildState.patch(guild.id, (state) => {
      if (state.expressions?.emojis) state.expressions.emojis = state.expressions.emojis.filter((entry) => entry.id !== emoji.id);
    });
    return emoji;
  }

  return { importFromSource, list, remove };
}
