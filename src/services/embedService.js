import {
  ContainerBuilder,
  EmbedBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  ThumbnailBuilder,
  WebhookClient
} from "discord.js";
import { parseColor } from "../shared/embeds.js";

const DEFAULTS = {
  enabled: true,
  mode: "components",
  channelId: "",
  destinationType: "channel",
  webhookUrl: "",
  title: "서버 공지",
  description: "공지사항이 아직 설정되지 않았습니다.",
  color: "#1a1d23",
  footer: "",
  authorName: "",
  authorUrl: "",
  thumbnailUrl: "",
  imageUrl: "",
  fields: [],
  componentsBody: "",
  mentionEveryone: false,
  mentionHere: false,
  mentionRoleIds: [],
  scheduleEnabled: false,
  scheduleIntervalMinutes: 60,
  lastSentAt: null,
  updatedAt: null
};

function normalizeBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => normalizeBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "on", "yes"].includes(value.trim().toLowerCase());
  return fallback;
}

function normalizeSettings(settings = {}) {
  const embed = { ...DEFAULTS, ...(settings.embed || {}), mode: "components", description: "" };
  embed.enabled = normalizeBoolean(embed.enabled, DEFAULTS.enabled);
  embed.scheduleEnabled = normalizeBoolean(embed.scheduleEnabled, DEFAULTS.scheduleEnabled);
  embed.mentionRoleIds = Array.isArray(embed.mentionRoleIds)
    ? embed.mentionRoleIds.filter((id) => /^\d{15,22}$/.test(String(id)))
    : [];
  embed.fields = Array.isArray(embed.fields) ? embed.fields.slice(0, 25) : [];
  return embed;
}

function normalizeRoleMentions(value, guild) {
  let text = String(value || "");
  const roles = [...(guild?.roles?.cache?.values?.() || [])]
    .filter((role) => role.id !== guild.id && role.name)
    .sort((a, b) => b.name.length - a.name.length);
  for (const role of roles) {
    const escaped = role.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\\\$&");
    text = text.replace(new RegExp(`@${escaped}(?![\\w])`, "g"), `<@&${role.id}>`);
  }
  return text;
}

function mentionPayload(settings, guild, includeContent = false) {
  const source = [
    settings.title,
    settings.description,
    settings.footer,
    settings.authorName,
    settings.componentsBody,
    ...(settings.fields || []).flatMap((field) => [field?.name, field?.value])
  ].filter(Boolean).map((value) => normalizeRoleMentions(value, guild)).join("\n");
  const everyone = /@everyone\b/.test(source);
  const here = /@here\b/.test(source);
  const roles = [...source.matchAll(/<@&(\d{15,22})>/g)].map((match) => match[1]);
  const uniqueRoles = [...new Set(roles)];
  const mentions = [everyone ? "@everyone" : "", here ? "@here" : "", ...uniqueRoles.map((id) => `<@&${id}>`)].filter(Boolean);
  return {
    ...(includeContent && mentions.length ? { content: mentions.join(" ") } : {}),
    allowedMentions: {
      parse: everyone || here ? ["everyone"] : [],
      roles: uniqueRoles
    }
  };
}

function legacyPayload(guild, settings) {
  const embed = new EmbedBuilder()
    .setTitle(String(settings.title || "서버 공지").slice(0, 256))
    .setDescription(String(settings.description || "").slice(0, 4000))
    .setColor(parseColor(settings.color));
  if (settings.footer) embed.setFooter({ text: String(settings.footer).slice(0, 2048) });
  if (settings.authorName) embed.setAuthor({ name: String(settings.authorName).slice(0, 256), url: settings.authorUrl || undefined });
  if (settings.thumbnailUrl) embed.setThumbnail(settings.thumbnailUrl);
  if (settings.imageUrl) embed.setImage(settings.imageUrl);
  const fields = settings.fields
    .filter((field) => field?.name && field?.value)
    .slice(0, 25)
    .map((field) => ({ name: String(field.name).slice(0, 256), value: String(field.value).slice(0, 1024), inline: Boolean(field.inline) }));
  if (fields.length) embed.addFields(fields);
  return { embeds: [embed], ...mentionPayload(settings, guild, true), username: guild?.name };
}

function componentsPayload(settings, guild) {
  const container = new ContainerBuilder();
  const contentParts = [];
  if (settings.title) contentParts.push(`# ${settings.title}`);
  if (settings.componentsBody) contentParts.push(settings.componentsBody);
  const lines = normalizeRoleMentions(contentParts.join("\n\n"), guild).split(/\r?\n/);
  let text = [];
  const flush = () => {
    if (!text.length) return;
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text.join("\n")));
    text = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const imageMatch = trimmed.match(/^\[image\]\s+(https?:\/\/\S+)$/i);
    const thumbnailMatch = trimmed.match(/^\[thumbnail\]\s+(https?:\/\/\S+)$/i);
    if (trimmed === "--" || trimmed === "---" || trimmed === "___") {
      flush();
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    } else if (imageMatch) {
      flush();
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(
          new MediaGalleryItemBuilder().setURL(imageMatch[1])
        )
      );
    } else if (thumbnailMatch) {
      flush();
      container.addSectionComponents(
        new SectionBuilder()
          .addTextDisplayComponents(new TextDisplayBuilder().setContent(" "))
          .setThumbnailAccessory(new ThumbnailBuilder({ media: { url: thumbnailMatch[1] } }))
      );
    } else {
      text.push(line);
    }
  }
  flush();
  if (settings.footer) {
    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${normalizeRoleMentions(settings.footer, guild)}`));
  }
  if (!lines.length && !settings.footer) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(" "));
  return { flags: MessageFlags.IsComponentsV2, components: [container], ...mentionPayload(settings, guild, false) };
}

export function createEmbedService(context) {
  function normalizeWebhookUrl(value) {
    const raw = String(value || "").trim();
    try {
      const url = new URL(raw);
      const allowedHost = url.hostname === "discord.com" || url.hostname === "discordapp.com";
      if (url.protocol !== "https:" || !allowedHost || !/^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  async function resolveChannel(guild, channelId) {
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased?.() ? channel : null;
  }

    function buildPayload(guild, settings) {
    const normalized = normalizeSettings({ embed: settings });
    return normalized.mode === "legacy" ? legacyPayload(guild, normalized) : componentsPayload(normalized, guild);
  }

  async function sendConfigured(guild, channelId, settingsOverride = null) {
    const stored = await context.services.settings.getSettings(guild.id);
    if (stored.embed?.enabled === false) throw new Error("현재 임베드 기능이 꺼져 있습니다.");
    const settings = settingsOverride || normalizeSettings(stored);
    const webhookUrl = settings.destinationType === "webhook" ? normalizeWebhookUrl(settings.webhookUrl) : "";
    if (settings.destinationType === "webhook") {
      if (!webhookUrl) throw new Error("유효한 Discord 웹훅 링크를 입력해야 합니다.");
      const webhook = new WebhookClient({ url: webhookUrl });
      const message = await webhook.send(buildPayload(guild, settings));
      await context.services.settings.updateSettings(guild.id, { embed: { lastSentAt: new Date().toISOString() } });
      return message;
    }
    const target = await resolveChannel(guild, channelId || settings.channelId);
    if (!target) throw new Error("전송할 텍스트 채널을 찾을 수 없습니다.");
    const message = await target.send(buildPayload(guild, settings));
    await context.services.settings.updateSettings(guild.id, {
      embed: { lastSentAt: new Date().toISOString() }
    });
    return message;
  }

  async function sendFromBody(guild, body) {
    let fields = [];
    try {
      fields = typeof body.embedFields === "string"
        ? JSON.parse(body.embedFields || "[]")
        : (body.embedFields || body.fields || []);
    } catch {
      fields = [];
    }
    const bool = (value) => normalizeBoolean(value, false);
    const settings = normalizeSettings({
      embed: {
        enabled: body.embedEnabled,
        mode: body.embedMode,
        channelId: body.embedChannelId || body.channelId,
        destinationType: body.embedDestinationType,
        webhookUrl: body.embedWebhookUrl,
        title: body.embedTitle,
        description: body.embedDescription,
        color: body.embedColor,
        footer: body.embedFooter,
        authorName: body.embedAuthorName,
        authorUrl: body.embedAuthorUrl,
        thumbnailUrl: body.embedThumbnailUrl,
        imageUrl: body.embedImageUrl,
        componentsBody: body.embedComponentsBody,
        fields,
        mentionEveryone: bool(body.embedMentionEveryone ?? body.mentionEveryone),
        mentionHere: bool(body.embedMentionHere ?? body.mentionHere),
        mentionRoleIds: body.embedMentionRoleIds,
        scheduleEnabled: bool(body.embedScheduleEnabled ?? body.scheduleEnabled),
        scheduleIntervalMinutes: body.embedScheduleIntervalMinutes
      }
    });
    return sendConfigured(guild, body.embedChannelId || body.channelId, settings);
  }

  async function processSchedules() {
    for (const guild of context.client?.guilds.cache.values() || []) {
      const settings = normalizeSettings(await context.services.settings.getSettings(guild.id));
      if (settings.enabled === false) continue;
      const hasDestination = settings.destinationType === "webhook" ? Boolean(settings.webhookUrl) : Boolean(settings.channelId);
      if (!settings.scheduleEnabled || !hasDestination) continue;
      const interval = Math.max(1, Number(settings.scheduleIntervalMinutes) || 60) * 60 * 1000;
      const last = settings.lastSentAt ? Date.parse(settings.lastSentAt) : 0;
      if (!last || Date.now() - last >= interval) {
        await sendConfigured(guild, settings.channelId, settings).catch(() => null);
      }
    }
  }

  return { buildPayload, sendConfigured, sendFromBody, processSchedules };
}
