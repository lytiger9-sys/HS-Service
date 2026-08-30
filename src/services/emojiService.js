import { PermissionFlagsBits } from "discord.js";

const MAX_BYTES = 256 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

function parseEmoji(value) {
  const match = String(value || "").trim().match(/^<(a?):([\w~+-]{2,32}):(\d+)>$/);
  if (!match) throw new Error("커스텀 이모지를 명령어 입력란에 그대로 넣어 주세요.");
  return { animated: Boolean(match[1]), name: match[2], id: match[3] };
}

function parseImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || !url.hostname) throw new Error("invalid-url");
    return url;
  } catch {
    throw new Error("이모지에는 https://로 시작하는 직접 이미지 링크를 입력해 주세요.");
  }
}

function nameFromUrl(url) {
  const filename = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
  const name = filename.replace(/[^\w~+-]/g, "").slice(0, 32);
  return name.length >= 2 ? name : `emoji${Date.now().toString(36)}`;
}

export function createEmojiService(context) {
  async function importEmoji(guild, value, requestedName, userId) {
    const source = parseEmoji(value);
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) throw new Error("봇에게 이모지 생성 권한이 없습니다.");
    const name = String(requestedName || source.name).replace(/[^\w~+-]/g, "").slice(0, 32);
    if (name.length < 2) throw new Error("이모지 이름은 2자 이상이어야 합니다.");
    await guild.emojis.fetch();
    if (guild.emojis.cache.some((emoji) => emoji.name === name)) throw new Error(`이미 같은 이름의 이모지 '${name}'가 있습니다.`);
    const extension = source.animated ? "gif" : "png";
    const response = await fetch(`https://cdn.discordapp.com/emojis/${source.id}.${extension}?size=256&quality=lossless`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("원본 이모지 이미지를 가져오지 못했습니다.");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES) throw new Error("이모지 이미지가 너무 큽니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_BYTES) throw new Error("이모지 이미지가 너무 큽니다.");
    const created = await guild.emojis.create({ attachment: buffer, name, reason: `이모지 스틸: ${userId}` });
    await context.services.guildState.patch(guild.id, (state) => {
      state.expressions ??= { emojis: [], sounds: [] };
      state.expressions.emojis ??= [];
      state.expressions.emojis.push({ id: created.id, name: created.name, sourceId: source.id, createdBy: userId, createdAt: new Date().toISOString() });
      state.expressions.emojis = state.expressions.emojis.slice(-100);
    });
    return created;
  }

  async function importEmojiFromUrl(guild, value, userId) {
    const sourceUrl = parseImageUrl(value);
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) throw new Error("봇에게 이모지 생성 권한이 없습니다.");

    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("이모지 이미지를 가져오지 못했습니다.");
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) throw new Error("이모지에는 PNG, JPG, GIF, WEBP 형식의 이미지 링크를 입력해 주세요.");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES) throw new Error("이모지 이미지는 256KB 이하여야 합니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("이모지 이미지가 비어 있습니다.");
    if (buffer.length > MAX_BYTES) throw new Error("이모지 이미지는 256KB 이하여야 합니다.");

    const name = nameFromUrl(sourceUrl);
    await guild.emojis.fetch();
    if (guild.emojis.cache.some((emoji) => emoji.name === name)) throw new Error(`이미 같은 이름의 이모지 '${name}'가 있습니다. 링크 파일 이름을 바꿔 다시 시도해 주세요.`);
    const created = await guild.emojis.create({ attachment: buffer, name, reason: `이모지 추가: ${userId}` });
    await context.services.guildState.patch(guild.id, (state) => {
      state.expressions ??= { emojis: [], sounds: [] };
      state.expressions.emojis ??= [];
      state.expressions.emojis.push({ id: created.id, name: created.name, sourceUrl: sourceUrl.toString(), createdBy: userId, createdAt: new Date().toISOString() });
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

  async function removeByValue(guild, value, member) {
    const source = parseEmoji(value);
    return remove(guild, source.id, member);
  }

  return { importEmoji, importEmojiFromUrl, list, remove, removeByValue };
}
