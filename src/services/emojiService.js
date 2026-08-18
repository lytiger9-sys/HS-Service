import { PermissionFlagsBits } from "discord.js";

const MAX_BYTES = 256 * 1024;

function parseEmoji(value) {
  const match = String(value || "").trim().match(/^<(a?):([\w~+-]{2,32}):(\d+)>$/);
  if (!match) throw new Error("커스텀 이모지 형식이 아닙니다. 메시지의 이모지를 그대로 입력해 주세요.");
  return { animated: Boolean(match[1]), name: match[2], id: match[3] };
}

export function createEmojiService(context) {
  async function importEmoji(guild, value, requestedName, userId) {
    const source = parseEmoji(value);
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) throw new Error("봇에게 이모지 생성 권한이 없습니다.");
    const name = String(requestedName || source.name).replace(/[^\w~+-]/g, "").slice(0, 32);
    if (name.length < 2) throw new Error("이모지 이름은 2자 이상이어야 합니다.");
    const extension = source.animated ? "gif" : "png";
    const response = await fetch(`https://cdn.discordapp.com/emojis/${source.id}.${extension}?size=256&quality=lossless`);
    if (!response.ok) throw new Error("원본 이모지 이미지를 가져오지 못했습니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error("이모지 이미지가 너무 큽니다.");
    const created = await guild.emojis.create({ attachment: buffer, name, reason: `이모지 스틸: ${userId}` });
    await context.services.guildState.patch(guild.id, (state) => {
      state.expressions ??= { emojis: [] };
      state.expressions.emojis ??= [];
      state.expressions.emojis.push({ id: created.id, name: created.name, sourceId: source.id, createdBy: userId, createdAt: new Date().toISOString() });
      state.expressions.emojis = state.expressions.emojis.slice(-100);
    });
    return created;
  }

  async function list(guild) {
    return [...guild.emojis.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  return { importEmoji, list };
}
