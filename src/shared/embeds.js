import { ContainerBuilder, EmbedBuilder, MessageFlags, SeparatorBuilder, TextDisplayBuilder } from "discord.js";
import { applyPlaceholders } from "./placeholders.js";
import { clampText } from "./naming.js";
import { formatKstDateTime } from "./time.js";

export const palette = {
  ink: 0x0f1115,
  graphite: 0x1a1d23,
  slate: 0x2b3038,
  paper: 0xf5f1e8,
  soft: 0xded7cb,
  accent: 0xa88352,
  success: 0x3f7a56,
  danger: 0xb35353,
  info: 0x4f6685
};

export function parseColor(value, fallback = palette.ink) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const hex = value.trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return Number.parseInt(hex, 16);
    }
  }

  return fallback;
}

export function createBaseEmbed({
  title,
  description,
  color = palette.ink,
  fields = [],
  footer,
  timestamp = false,
  author,
  thumbnail,
  image
} = {}) {
  const embed = new EmbedBuilder().setColor(color);

  if (title) {
    embed.setTitle(clampText(title, 256));
  }

  if (description) {
    embed.setDescription(clampText(description, 4000));
  }

  if (fields.length) {
    embed.addFields(
      fields.map((field) => ({
        name: clampText(field.name, 256),
        value: clampText(field.value, 1024),
        inline: Boolean(field.inline)
      }))
    );
  }

  if (footer) {
    embed.setFooter({ text: clampText(footer, 2048) });
  }

  if (timestamp) {
    embed.setTimestamp(new Date(timestamp === true ? Date.now() : timestamp));
  }

  if (author) {
    embed.setAuthor(author);
  }

  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }

  if (image) {
    embed.setImage(image);
  }

  return embed;
}

export { createBaseEmbed as buildBaseEmbed };

export function convertLegacyPayload(payload, footerText = "Powered by HS-Service") {
  if (!payload || payload.flags === MessageFlags.IsComponentsV2 || !Array.isArray(payload.embeds) || !payload.embeds.length) return payload;
  const container = new ContainerBuilder();
  payload.embeds.forEach((raw, index) => {
    const embed = typeof raw?.toJSON === "function" ? raw.toJSON() : raw;
    const title = embed.title ? `## ${embed.title}` : "";
    const author = embed.author?.name ? `**${embed.author.name}**` : "";
    const body = [title, author, embed.description || ""].filter(Boolean).join("\n\n");
    if (body) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(body));
    if (embed.fields?.length) {
      if (body || index > 0) container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(embed.fields.map((field) => `**${field.name}**\n${field.value}`).join("\n\n")));
    }
    const media = [embed.thumbnail?.url, embed.image?.url].filter(Boolean);
    if (media.length) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(media.map((url) => `[이미지 보기](${url})`).join("\n")));
    }
    if (embed.timestamp) {
      container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`<t:${Math.floor(new Date(embed.timestamp).getTime() / 1000)}:F>`));
    }
  });
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
  const { embeds, ...rest } = payload;
  return { ...rest, flags: MessageFlags.IsComponentsV2, components: [container] };
}

export function buildWelcomeEmbeds(settings, member, guild) {
  const context = {
    user: member.user,
    guild,
    totalmember: guild.memberCount
  };

  const channelDescription = applyPlaceholders(settings.welcome.embedDescription, context);
  const dmMessage = applyPlaceholders(settings.welcome.dmMessage, context);

  const channelEmbed = createBaseEmbed({
    title: applyPlaceholders(settings.welcome.embedTitle, context),
    description: channelDescription,
    color: parseColor(settings.welcome.embedColor),
    footer: guild.name,
    timestamp: Date.now()
  }).setThumbnail(member.user.displayAvatarURL({ size: 256 }));

  const dmEmbed = createBaseEmbed({
    title: applyPlaceholders(settings.welcome.dmTitle, context),
    description: dmMessage,
    color: parseColor(settings.welcome.dmColor),
    footer: guild.name,
    timestamp: Date.now()
  }).setThumbnail(member.user.displayAvatarURL({ size: 256 }));

  return { channelEmbed, dmEmbed };
}

export function buildNoticeEmbed(guild, notice) {
  return createBaseEmbed({
    title: "서버 공지",
    description: notice?.content || "공지사항이 비어 있습니다.",
    color: palette.graphite,
    footer: guild.name,
    timestamp: notice?.updatedAt || Date.now()
  });
}

export function buildServerInfoComponents(guild, stats) {
  const createdAt = Math.floor(guild.createdTimestamp / 1000);
  const container = new ContainerBuilder()
    .setAccentColor(palette.ink)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 서버 정보\n${guild.name}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      `**서버 ID**\n${guild.id}`,
      `**서버 소유자**\n<@${guild.ownerId}>`,
      `**생성일**\n<t:${createdAt}:d>`
    ].join("\n\n")))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent([
      "**서버 규모**",
      `전체 인원 · ${stats.totalMembers}명`,
      `사람 · ${stats.humans}명`,
      `봇 · ${stats.bots}명`,
      `채널 · ${stats.channels}개`,
      `역할 · ${stats.roles}개`,
      `관리자 · ${stats.adminCount}명`
    ].join("\n")))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("-# Powered by HS-Service"));

  return { flags: MessageFlags.IsComponentsV2, components: [container], allowedMentions: { parse: [] } };
}

export function buildPollEmbed(poll, forceResults = true) {
  const showResults = forceResults || poll.resultVisibility !== "private" || poll.expired;
  const lines = poll.options.map((option, index) => {
    const label = option.isFreeText ? `${option.label} (자유 입력)` : option.label;
    return `${index + 1}. ${label}${showResults ? ` - ${option.count}표` : ""}`;
  });

  const footerText = poll.freeTextAnswers?.length
    ? `자유 입력 답변 ${poll.freeTextAnswers.length}개`
    : "자유 입력 답변 없음";

  return createBaseEmbed({
    title: poll.question,
    description: [poll.description || "설명 없음", "", ...lines, poll.expiresAt ? `만료: ${formatKstDateTime(poll.expiresAt)}` : ""].filter(Boolean).join("\n"),
    color: palette.slate,
    footer: footerText,
    timestamp: poll.createdAt
  });
}
