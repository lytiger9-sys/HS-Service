import crypto from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits
} from "discord.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_MS = 7 * DAY_MS;

function nowIso() {
  return new Date().toISOString();
}

function shortId() {
  return crypto.randomBytes(5).toString("hex");
}

function text(value, fallback = "", max = 2000) {
  return String(value ?? fallback).trim().slice(0, max);
}

function buildChannelName(settings, affiliateName, banner = false) {
  const config = banner ? settings.banner : settings;
  return text(`${config.nameEmoji || ""}${config.namePrefix || ""}${affiliateName}${config.nameSuffix || ""}`, "파트너", 90)
    .replace(/[\\/#@:`<>"|*?]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function partnerEmbed(settings) {
  return new EmbedBuilder()
    .setTitle(settings.embedTitle || "파트너 모집")
    .setDescription(settings.embedDescription || "파트너 조건을 확인한 후 신청해 주세요.")
    .setColor(settings.embedColor || "#3a7da8")
    .setFooter({ text: "HS Service Partner" });
}

function conditionComponents(settings) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("partner:apply")
      .setLabel(settings.buttonLabel || "파트너 신청")
      .setStyle(ButtonStyle.Primary)
  )];
}

function applicationEmbed(application) {
  return new EmbedBuilder()
    .setTitle("새 파트너 신청")
    .setColor("#b89968")
    .addFields(
      { name: "제휴명", value: application.affiliateName || "-", inline: true },
      { name: "현 인원", value: application.memberCount || "-", inline: true },
      { name: "복구키 사용", value: application.recoveryKeyUsed || "-", inline: true },
      { name: "서버 링크", value: application.serverLink || "-", inline: false },
      { name: "홍보 웹훅", value: application.promoWebhook || "-", inline: false },
      { name: "신청자", value: `<@${application.requesterId}>`, inline: true }
    )
    .setTimestamp(new Date(application.createdAt));
}

function approvalComponents(id) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`partner:approve:${id}`).setLabel("승인").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`partner:reject:${id}`).setLabel("거절").setStyle(ButtonStyle.Danger)
  )];
}

export function createPartnerService(context) {
  const state = (guildId) => context.services.guildState.snapshot(guildId) || {};

  async function patch(guildId, updater) {
    return context.services.guildState.patch(guildId, updater);
  }

  async function syncConditionsMessage(guildId) {
    const guild = await context.client.guilds.fetch(guildId);
    const current = state(guildId);
    const settings = current.settings?.partner;
    if (!settings?.enabled || !settings.conditionsChannelId) return null;
    const channel = await guild.channels.fetch(settings.conditionsChannelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    const payload = { embeds: [partnerEmbed(settings)], components: conditionComponents(settings) };
    let message = settings.conditionsMessageId
      ? await channel.messages.fetch(settings.conditionsMessageId).catch(() => null)
      : null;
    if (message) await message.edit(payload);
    else message = await channel.send(payload);
    await patch(guildId, (draft) => {
      draft.settings.partner.conditionsMessageId = message.id;
    });
    return message;
  }

  async function createApplication(interaction) {
    const values = {
      affiliateName: text(interaction.fields.getTextInputValue("partner-affiliate-name"), "", 80),
      memberCount: text(interaction.fields.getTextInputValue("partner-member-count"), "", 30),
      recoveryKeyUsed: text(interaction.fields.getTextInputValue("partner-recovery-key"), "", 30),
      serverLink: text(interaction.fields.getTextInputValue("partner-server-link"), "", 500),
      promoWebhook: text(interaction.fields.getTextInputValue("partner-promo-webhook"), "", 500)
    };
    if (!values.affiliateName || !values.serverLink) throw new Error("제휴명과 서버 링크는 필수입니다.");
    const id = shortId();
    const application = {
      id,
      ...values,
      requesterId: interaction.user.id,
      requesterTag: interaction.user.tag,
      status: "pending",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    await patch(interaction.guildId, (draft) => {
      draft.partners ??= [];
      draft.partners.push(application);
    });
    const settings = state(interaction.guildId).settings.partner;
    const approvalChannel = await interaction.guild.channels.fetch(settings.approvalChannelId).catch(() => null);
    if (!approvalChannel?.isTextBased()) throw new Error("파트너 승인 채널이 설정되지 않았습니다.");
    await approvalChannel.send({ embeds: [applicationEmbed(application)], components: approvalComponents(id) });
    return application;
  }

  async function approve(guildId, applicationId, moderator) {
    const current = state(guildId);
    const application = (current.partners || []).find((item) => item.id === applicationId);
    if (!application || application.status !== "pending") return null;
    const settings = current.settings.partner;
    const category = await context.client.channels.fetch(settings.partnerCategoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("파트너 카테고리를 찾을 수 없습니다.");
    const guild = await context.client.guilds.fetch(guildId);
    const channel = await guild.channels.create({
      name: buildChannelName(settings, application.affiliateName),
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] },
        { id: application.requesterId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }
      ]
    });
    const webhook = await channel.createWebhook({ name: `${application.affiliateName} Partner` });
    const updated = {
      ...application,
      status: "active",
      channelId: channel.id,
      webhookUrl: webhook.url,
      approvedBy: moderator.id,
      approvedAt: nowIso(),
      lastMessageAt: nowIso(),
      mentionDate: "",
      dailyMentionCount: 0,
      warningCount: 0,
      updatedAt: nowIso()
    };
    await patch(guildId, (draft) => {
      const index = draft.partners.findIndex((item) => item.id === applicationId);
      if (index >= 0) draft.partners[index] = updated;
    });
    const user = await context.client.users.fetch(application.requesterId).catch(() => null);
    await user?.send(`파트너 신청이 승인되었습니다. 홍보 메시지용 웹훅입니다:\n${webhook.url}`).catch(() => null);
    return updated;
  }

  async function reject(guildId, applicationId, moderator) {
    let rejected = null;
    await patch(guildId, (draft) => {
      const item = draft.partners.find((partner) => partner.id === applicationId);
      if (!item || item.status !== "pending") return;
      item.status = "rejected";
      item.rejectedBy = moderator.id;
      item.rejectedAt = nowIso();
      rejected = item;
    });
    if (rejected) {
      const user = await context.client.users.fetch(rejected.requesterId).catch(() => null);
      await user?.send("파트너 신청이 거절되었습니다.").catch(() => null);
    }
    return rejected;
  }

  async function handleMessage(message) {
    const current = state(message.guild.id);
    const partner = (current.partners || []).find((item) => item.status === "active" && item.channelId === message.channel.id);
    if (!partner) return false;
    await patch(message.guild.id, (draft) => {
      const item = draft.partners.find((entry) => entry.id === partner.id);
      if (item) item.lastMessageAt = nowIso();
    });
    if (!message.mentions.everyone || message.author.id !== partner.requesterId) return true;
    const today = new Date().toISOString().slice(0, 10);
    let nextCount = 1;
    let warningCount = partner.warningCount || 0;
    if (partner.mentionDate === today) nextCount = (partner.dailyMentionCount || 0) + 1;
    if (nextCount < 2) {
      await patch(message.guild.id, (draft) => {
        const item = draft.partners.find((entry) => entry.id === partner.id);
        if (item) { item.mentionDate = today; item.dailyMentionCount = nextCount; }
      });
      return true;
    }
    warningCount += 1;
    const durationMs = warningCount >= 2 ? 7 * DAY_MS : DAY_MS;
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    await member?.timeout(durationMs, "파트너 채널 전체 멘션 제재").catch(() => null);
    await member?.send(`파트너 채널에서 하루 2회 이상 전체 멘션을 사용해 ${warningCount >= 2 ? "7일" : "1일"} 타임아웃이 적용되었습니다.`).catch(() => null);
    await patch(message.guild.id, (draft) => {
      const item = draft.partners.find((entry) => entry.id === partner.id);
      if (item) { item.mentionDate = today; item.dailyMentionCount = nextCount; item.warningCount = warningCount; }
    });
    return true;
  }

  async function listStale(guildId) {
    const cutoff = Date.now() - STALE_MS;
    return (state(guildId).partners || []).filter((partner) => partner.status === "active" && new Date(partner.lastMessageAt || partner.approvedAt).getTime() < cutoff);
  }

  async function createBanner(guildId, { licenseKey, serverName, serverLink, promoWebhook }) {
    const current = state(guildId);
    const settings = current.settings?.partner?.banner;
    if (!settings?.enabled || !settings.categoryId) throw new Error("상단배너 기능 또는 배너 카테고리가 설정되지 않았습니다.");
    const license = await context.services.licenses.activate(licenseKey, guildId);
    if (!license || !["pro", "enterprise"].includes(license.plan)) throw new Error("상단배너를 사용할 수 있는 플랜이 아닙니다.");
    const category = await context.client.channels.fetch(settings.categoryId).catch(() => null);
    if (!category || category.type !== ChannelType.GuildCategory) throw new Error("상단배너 카테고리를 찾을 수 없습니다.");
    const guild = await context.client.guilds.fetch(guildId);
    const channel = await guild.channels.create({
      name: buildChannelName(settings, text(serverName, "서버", 70), true),
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [{ id: guild.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.MentionEveryone] }]
    });
    await channel.send({ embeds: [new EmbedBuilder().setTitle(settings.embedTitle).setDescription(`${settings.embedDescription}\\n\\n서버: ${text(serverName, "-", 80)}\\n링크: ${text(serverLink, "-", 500)}\\n홍보 웹훅: ${text(promoWebhook, "-", 500)}`).setColor(settings.embedColor)] });
    const slot = { id: shortId(), licenseId: String(license._id), channelId: channel.id, serverName: text(serverName, "서버", 80), serverLink: text(serverLink, "", 500), promoWebhook: text(promoWebhook, "", 500), expiresAt: license.expiresAt, createdAt: nowIso() };
    await patch(guildId, (draft) => { draft.bannerSlots ??= []; draft.bannerSlots.push(slot); });
    return slot;
  }

  async function cleanupExpiredBanners(guildId) {
    const current = state(guildId);
    const expired = (current.bannerSlots || []).filter((slot) => slot.expiresAt && new Date(slot.expiresAt) <= new Date());
    if (!expired.length) return 0;
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    for (const slot of expired) await guild?.channels.delete(slot.channelId).catch(() => null);
    await patch(guildId, (draft) => { draft.bannerSlots = (draft.bannerSlots || []).filter((slot) => !expired.some((item) => item.id === slot.id)); });
    return expired.length;
  }

  async function deletePartner(guildId, id) {
    const current = state(guildId);
    const partner = (current.partners || []).find((item) => item.id === id);
    if (!partner) return null;
    const guild = await context.client.guilds.fetch(guildId);
    if (partner.channelId) await guild.channels.delete(partner.channelId).catch(() => null);
    await patch(guildId, (draft) => {
      draft.partners = (draft.partners || []).filter((item) => item.id !== id);
    });
    return partner;
  }

  return { syncConditionsMessage, createApplication, approve, reject, handleMessage, listStale, deletePartner, createBanner, cleanupExpiredBanners };
}
