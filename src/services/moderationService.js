import { PermissionFlagsBits } from "discord.js";
import { buildBaseEmbed, palette } from "../shared/embeds.js";

const recentMessages = new Map();

function normalizeContent(content) {
  return String(content ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isInviteLink(content) {
  return /(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i.test(content);
}

function containsProfanity(content, words) {
  const normalized = normalizeContent(content);
  return words.some((word) => {
    const needle = normalizeContent(word);
    if (!needle) {
      return false;
    }

    return normalized.includes(needle);
  });
}

function isExempt(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

function getUserBucket(guildId, userId) {
  const key = `${guildId}:${userId}`;
  if (!recentMessages.has(key)) {
    recentMessages.set(key, []);
  }
  return recentMessages.get(key);
}

function detectSpam(message, settings) {
  const bucket = getUserBucket(message.guild.id, message.author.id);
  const now = Date.now();
  const windowMs = (settings.spamWindowSeconds || 12) * 1000;
  const normalized = normalizeContent(message.content);

  bucket.push({ content: normalized, at: now });
  while (bucket.length && now - bucket[0].at > windowMs) {
    bucket.shift();
  }

  const sameCount = bucket.filter((entry) => entry.content === normalized).length;
  return sameCount >= (settings.spamRepeatThreshold || 3);
}

async function applyTimeout(context, message, minutes, reason, type) {
  const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!member || !member.moderatable) {
    return false;
  }

  const duration = Math.min(Math.max(Number(minutes) || 0, 0), 60 * 24 * 28);
  if (duration <= 0) {
    return false;
  }

  await member.timeout(duration * 60 * 1000, reason).catch(() => null);
  const punishment = await context.services.punishments.addPunishment(message.guild.id, {
    type,
    memberId: member.id,
    memberTag: member.user.tag,
    moderatorId: context.client.user.id,
    moderatorTag: context.client.user.tag,
    reason,
    durationMinutes: duration,
    source: "auto-moderation",
    channelId: message.channelId,
    expiresAt: new Date(Date.now() + duration * 60 * 1000).toISOString()
  });

  await context.services.logs.sendLogByKey(message.guild.id, "moderationChannelId", {
    embeds: [
      buildBaseEmbed({
        title: "자동 제재",
        description: `${member.user.tag} 에게 타임아웃을 적용했습니다.`,
        color: palette.danger,
        fields: [
          { name: "사유", value: reason, inline: false },
          { name: "기간", value: `${duration}분`, inline: true },
          { name: "채널", value: `<#${message.channelId}>`, inline: true }
        ],
        timestamp: Date.now()
      })
    ]
  });

  return punishment;
}

export function createModerationService(context, guildState) {
  async function evaluateMessage(message) {
    if (!message.guild || message.author.bot) {
      return null;
    }

    if (message.guild.id !== context.config.allowedGuildId) {
      return null;
    }

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member || isExempt(member)) {
      return null;
    }

    const settings = (await context.services.settings.getSettings(message.guild.id)).security;
    if (settings.enabled === false) {
      return null;
    }
    const triggers = [];

    if (settings.massMentionEnabled !== false && message.mentions.everyone) {
      triggers.push({
        type: "mass-mention",
        label: "전체 멘션",
        minutes: settings.massMentionTimeoutMinutes
      });
    }

    if (settings.inviteEnabled !== false && isInviteLink(message.content)) {
      triggers.push({
        type: "invite-link",
        label: "초대 링크",
        minutes: settings.inviteTimeoutMinutes
      });
    }

    if (settings.profanityEnabled !== false && containsProfanity(message.content, settings.profanityWords || [])) {
      triggers.push({
        type: "profanity",
        label: "욕설",
        minutes: settings.profanityTimeoutMinutes
      });
    }

    if (settings.spamEnabled !== false && detectSpam(message, settings)) {
      triggers.push({
        type: "spam",
        label: "도배",
        minutes: settings.spamTimeoutMinutes
      });
    }

    if (!triggers.length) {
      return null;
    }

    const minutes = Math.max(...triggers.map((entry) => Number(entry.minutes) || 0));
    const reason = triggers.map((entry) => entry.label).join(", ");
    return applyTimeout(context, message, minutes, reason, triggers[0].type);
  }

  return {
    evaluateMessage
  };
}
