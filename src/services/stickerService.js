import { PermissionFlagsBits } from "discord.js";

const MAX_FILE_BYTES = 512 * 1024;
const SUPPORTED_TYPES = new Set(["image/png", "application/json"]);

function cleanName(value, fallback = "sticker") {
  const name = String(value || fallback).replace(/[^\w~-]/g, "").slice(0, 30);
  return name.length >= 2 ? name : "sticker";
}

function parseImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || !url.hostname) throw new Error("invalid-url");
    return url;
  } catch {
    throw new Error("스티커에는 https://로 시작하는 직접 이미지 링크를 입력해 주세요.");
  }
}

function nameFromUrl(url) {
  const filename = decodeURIComponent(url.pathname.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
  return cleanName(filename, "sticker");
}

export function createStickerService(context) {
  async function getBotMember(guild) {
    return guild.members.me || await guild.members.fetchMe().catch(() => null);
  }

  async function createFromUrl(guild, value, userId) {
    const sourceUrl = parseImageUrl(value);
    const bot = await getBotMember(guild);
    if (!bot?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) {
      throw new Error("봇에게 스티커 생성 권한이 없습니다.");
    }

    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("스티커 이미지를 가져오지 못했습니다.");
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!SUPPORTED_TYPES.has(contentType)) {
      throw new Error("스티커는 PNG 또는 Lottie JSON 이미지 링크만 사용할 수 있습니다.");
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES) throw new Error("스티커 파일은 512KB 이하여야 합니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error("스티커 이미지가 비어 있습니다.");
    if (buffer.length > MAX_FILE_BYTES) throw new Error("스티커 파일은 512KB 이하여야 합니다.");

    const name = nameFromUrl(sourceUrl);
    await guild.stickers.fetch();
    if (guild.stickers.cache.some((sticker) => sticker.name === name)) {
      throw new Error(`이미 같은 이름의 스티커 '${name}'가 있습니다. 링크 파일 이름을 바꿔 다시 시도해 주세요.`);
    }

    const fileExtension = contentType === "application/json" ? "json" : "png";
    const created = await guild.stickers.create({
      file: { attachment: buffer, name: `${name}.${fileExtension}` },
      name,
      tags: "sticker",
      reason: `스티커 추가: ${userId}`
    });
    await context.services.guildState.patch(guild.id, (state) => {
      state.expressions ??= { emojis: [], sounds: [], stickers: [] };
      state.expressions.stickers ??= [];
      state.expressions.stickers.push({
        id: created.id,
        name: created.name,
        sourceUrl: sourceUrl.toString(),
        createdBy: userId,
        createdAt: new Date().toISOString()
      });
      state.expressions.stickers = state.expressions.stickers.slice(-100);
    });
    return created;
  }

  return { createFromUrl };
}
