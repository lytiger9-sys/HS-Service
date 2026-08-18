import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  VoiceConnectionStatus
} from "@discordjs/voice";

const MAX_TEXT_LENGTH = 300;
const IDLE_LEAVE_MS = 60_000;

export function createTtsService() {
  const sessions = new Map();

  function apiConfig() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("TTS API 키가 서버에 설정되어 있지 않습니다.");
    return {
      apiKey,
      baseUrl: (process.env.OPENAI_API_BASE || "https://api.openai.com/v1").replace(/\/$/, ""),
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "alloy"
    };
  }

  async function synthesize(text) {
    const config = apiConfig();
    const response = await fetch(`${config.baseUrl}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: config.model, voice: config.voice, input: text.slice(0, MAX_TEXT_LENGTH), response_format: "mp3" })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(detail.slice(0, 160) || "TTS 음성을 생성하지 못했습니다.");
    }
    const directory = await mkdir(path.join(os.tmpdir(), "hs-service-tts"), { recursive: true }).then(() => path.join(os.tmpdir(), "hs-service-tts"));
    const filePath = path.join(directory, `${randomUUID()}.mp3`);
    await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    return filePath;
  }

  async function ensureSession(channel) {
    const existing = sessions.get(channel.guild.id);
    if (existing?.connection?.joinConfig.channelId === channel.id) return existing;
    if (existing) await leave(channel.guild.id);
    const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator, selfDeaf: true });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
    connection.subscribe(player);
    const session = { connection, player, queue: [], playing: false, idleTimer: null, channelId: channel.id };
    player.on(AudioPlayerStatus.Idle, () => { session.playing = false; void playNext(channel.guild.id); });
    player.on("error", () => { session.playing = false; void playNext(channel.guild.id); });
    sessions.set(channel.guild.id, session);
    return session;
  }

  async function playNext(guildId) {
    const session = sessions.get(guildId);
    if (!session || session.playing) return;
    const item = session.queue.shift();
    if (!item) {
      session.idleTimer = setTimeout(() => void leave(guildId), IDLE_LEAVE_MS);
      return;
    }
    session.playing = true;
    try {
      const filePath = await synthesize(item.text);
      session.player.play(createAudioResource(filePath));
      const cleanup = () => void rm(filePath, { force: true }).catch(() => null);
      session.player.once(AudioPlayerStatus.Idle, cleanup);
      session.player.once("error", cleanup);
    } catch (error) {
      item.reject(error);
      session.playing = false;
      return playNext(guildId);
    }
    item.resolve();
  }

  async function speak(channel, text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) throw new Error("읽을 문장을 입력해 주세요.");
    if (cleanText.length > MAX_TEXT_LENGTH) throw new Error(`TTS 문장은 ${MAX_TEXT_LENGTH}자 이하로 입력해 주세요.`);
    const session = await ensureSession(channel);
    if (session.idleTimer) clearTimeout(session.idleTimer);
    return new Promise((resolve, reject) => {
      session.queue.push({ text: cleanText, resolve, reject });
      void playNext(channel.guild.id);
    });
  }

  async function stop(guildId) {
    const session = sessions.get(guildId);
    if (!session) return false;
    session.queue.splice(0).forEach((item) => item.reject(new Error("TTS 재생이 중지되었습니다.")));
    session.player.stop(true);
    session.playing = false;
    return true;
  }

  async function leave(guildId) {
    const session = sessions.get(guildId);
    if (!session) return false;
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.queue.splice(0).forEach((item) => item.reject(new Error("음성 채널에서 퇴장했습니다.")));
    session.player.stop(true);
    session.connection.destroy();
    sessions.delete(guildId);
    return true;
  }

  return { speak, stop, leave, maxTextLength: MAX_TEXT_LENGTH };
}
