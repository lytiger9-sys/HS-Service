import { PermissionFlagsBits } from "discord.js";

const MAX_FILE_BYTES = 512 * 1024;

function cleanName(value, fallback) {
  const name = String(value || fallback || "sound").replace(/[^\w~-]/g, "").slice(0, 32);
  if (name.length < 2) throw new Error("사운드 이름은 2자 이상이어야 합니다.");
  return name;
}

export function createSoundboardService(context) {
  async function getBotMember(guild) {
    return guild.members.me || await guild.members.fetchMe().catch(() => null);
  }

  async function steal({ targetGuild, sourceGuildId, soundId, name, userId }) {
    const bot = await getBotMember(targetGuild);
    if (!bot?.permissions.has(PermissionFlagsBits.CreateGuildExpressions)) throw new Error("봇에게 대상 서버의 사운드보드 생성 권한이 없습니다.");
    const sourceGuild = context.client.guilds.cache.get(sourceGuildId) || await context.client.guilds.fetch(sourceGuildId).catch(() => null);
    if (!sourceGuild) throw new Error("원본 서버에 봇이 들어가 있지 않거나 서버를 찾을 수 없습니다.");
    const sourceSound = await sourceGuild.soundboardSounds.fetch(soundId).catch(() => null);
    if (!sourceSound?.url) throw new Error("원본 사운드를 찾을 수 없습니다.");
    const response = await fetch(sourceSound.url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("원본 사운드 파일을 가져오지 못했습니다.");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_FILE_BYTES) throw new Error("사운드 파일이 Discord 제한인 512KB를 초과합니다.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) throw new Error("사운드 파일이 Discord 제한인 512KB를 초과합니다.");
    const created = await targetGuild.soundboardSounds.create({ file: buffer, name: cleanName(name, sourceSound.name), contentType: response.headers.get("content-type") || "audio/mpeg", volume: sourceSound.volume, emojiName: sourceSound.emoji?.name, reason: `사운드보드 스틸: ${userId}` });
    await context.services.guildState.patch(targetGuild.id, (state) => {
      state.expressions ??= { emojis: [], sounds: [] };
      state.expressions.sounds ??= [];
      state.expressions.sounds.push({ id: created.soundId || created.id, name: created.name, sourceGuildId, sourceId: soundId, createdBy: userId, createdAt: new Date().toISOString() });
      state.expressions.sounds = state.expressions.sounds.slice(-100);
    });
    return created;
  }

  async function list(guild) {
    const sounds = await guild.soundboardSounds.fetch();
    return [...sounds.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function remove(guild, soundId, member) {
    if (!member?.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) throw new Error("사운드보드 관리 권한이 필요합니다.");
    const sound = await guild.soundboardSounds.fetch(soundId).catch(() => null);
    if (!sound) throw new Error("해당 사운드를 찾을 수 없습니다.");
    await guild.soundboardSounds.delete(sound.id);
    await context.services.guildState.patch(guild.id, (state) => {
      if (state.expressions?.sounds) state.expressions.sounds = state.expressions.sounds.filter((entry) => entry.id !== sound.id);
    });
    return sound;
  }

  return { steal, list, remove };
}
