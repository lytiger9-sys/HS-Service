import crypto from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorBuilder,
  TextDisplayBuilder,
  WebhookClient
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
  return text(`${config.namePrefix || ""}${affiliateName}${config.nameSuffix || ""}`, "파트너", 90)
    .replace(/[\\/#@:`<>"|*?]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

function colorNumber(value, fallback = 0x3a7da8) {
  const normalized = String(value || "").replace(/^#/, "");
  const parsed = Number.parseInt(normalized, 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function conditionComponents(settings) {
  const container = new ContainerBuilder()
    .setAccentColor(colorNumber(settings.embedColor))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${settings.embedTitle || "파트너 모집"}\n${settings.embedDescription || "파트너 조건을 확인한 후 신청해 주세요."}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("파트너 조건을 확인했다면 아래 버튼을 눌러 신청서를 제출하세요."))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("partner:apply")
        .setLabel(settings.buttonLabel || "파트너 신청")
        .setStyle(ButtonStyle.Primary)
    ));
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
}

function bannerComponents(settings, details = null) {
  const container = new ContainerBuilder()
    .setAccentColor(colorNumber(settings.embedColor, 0xb89968))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${settings.embedTitle || "상단 배너"}\n${settings.embedDescription || "상단 배너 안내"}`))
    .addSeparatorComponents(new SeparatorBuilder().setDivider(true));
  if (details) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**서버명:** ${details.serverName}\n**서버 링크:** ${details.serverLink}\n**홍보 웹훅:** ${details.promoWebhook}`));
  } else {
    container
      .addTextDisplayComponents(new TextDisplayBuilder().setContent("상단배너 라이선스를 받은 서버 관리자는 아래 버튼을 눌러 서버 정보를 등록하세요."))
      .addActionRowComponents(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("banner:register")
          .setLabel(settings.buttonLabel || "상단배너 신청")
          .setStyle(ButtonStyle.Primary)
      ));
  }
  return { flags: MessageFlags.IsComponentsV2, components: [container] };
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
    const payload = conditionComponents(settings);
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

  async function syncBannerMessage(guildId) {
    const guild = await context.client.guilds.fetch(guildId);
    const current = state(guildId);
    const settings = current.settings?.partner?.banner;
    if (!settings?.enabled || !settings.channelId) return null;
    const channel = await guild.channels.fetch(settings.channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    const payload = bannerComponents(settings);
    let message = settings.messageId ? await channel.messages.fetch(settings.messageId).catch(() => null) : null;
    if (message) await message.edit(payload);
    else message = await channel.send(payload);
    await patch(guildId, (draft) => { draft.settings.partner.banner.messageId = message.id; });
    return message;
  }

  async function createApplication(interaction) {
    const current = state(interaction.guildId);
    if (current.settings?.partner?.enabled === false) throw new Error("현재 파트너 기능이 꺼져 있습니다.");
    const values = {
      affiliateName: text(interaction.fields.getTextInputValue("partner-affiliate-name"), "", 80),
      memberCount: text(interaction.fields.getTextInputValue("partner-member-count"), "", 30),
      recoveryKeyUsed: text(interaction.fields.getTextInputValue("partner-recovery-key"), "", 30),
      serverLink: text(interaction.fields.getTextInputValue("partner-server-link"), "", 500),
      promoWebhook: text(interaction.fields.getTextInputValue("partner-promo-webhook"), "", 500)
    };
    if (!values.affiliateName || !values.serverLink || !values.promoWebhook) throw new Error("제휴명·서버 링크·홍보 웹훅은 필수입니다.");
    for (const [label, value] of [["서버 링크", values.serverLink], ["홍보 웹훅", values.promoWebhook]]) {
      let parsed;
      try { parsed = new URL(value); } catch { parsed = null; }
      if (!parsed || parsed.protocol !== "https:") throw new Error(`${label}은 https URL이어야 합니다.`);
    }
    if ((current.partners || []).some((item) => ["pending", "active"].includes(item.status) && item.requesterId === interaction.user.id)) {
      throw new Error("이미 처리 중인 파트너 신청이 있습니다.");
    }
    const settings = current.settings?.partner;
    const approvalChannel = await interaction.guild.channels.fetch(settings?.approvalChannelId).catch(() => null);
    if (!approvalChannel?.isTextBased()) throw new Error("파트너 승인 채널이 설정되지 않았습니다.");
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
    const approvalMessage = await approvalChannel.send({ embeds: [applicationEmbed(application)], components: approvalComponents(id) });
    application.approvalMessageId = approvalMessage.id;
    await patch(interaction.guildId, (draft) => {
      draft.partners ??= [];
      draft.partners.push(application);
    });
    return application;
  }

  async function approve(guildId, applicationId, moderator) {
    const current = state(guildId);
    if (current.settings?.partner?.enabled === false) throw new Error("현재 파트너 기능이 꺼져 있습니다.");
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
      penaltyDate: "",
      updatedAt: nowIso()
    };
    await patch(guildId, (draft) => {
      const index = draft.partners.findIndex((item) => item.id === applicationId);
      if (index >= 0) draft.partners[index] = updated;
    });
    const approvalChannel = await guild.channels.fetch(settings.approvalChannelId).catch(() => null);
    const approvalMessage = application.approvalMessageId ? await approvalChannel?.messages.fetch(application.approvalMessageId).catch(() => null) : null;
    await approvalMessage?.edit({ embeds: [applicationEmbed(updated).setTitle("파트너 신청 승인")], components: [] }).catch(() => null);
    const user = await context.client.users.fetch(application.requesterId).catch(() => null);
    await user?.send(`파트너 신청이 승인되었습니다. 홍보 메시지용 웹훅입니다:\n${webhook.url}`).catch(() => null);
    return updated;
  }

  async function reject(guildId, applicationId, moderator) {
    const current = state(guildId);
    if (current.settings?.partner?.enabled === false) throw new Error("현재 파트너 기능이 꺼져 있습니다.");
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
      const guild = await context.client.guilds.fetch(guildId).catch(() => null);
      const approvalChannel = await guild?.channels.fetch(state(guildId).settings?.partner?.approvalChannelId).catch(() => null);
      const approvalMessage = rejected.approvalMessageId ? await approvalChannel?.messages.fetch(rejected.approvalMessageId).catch(() => null) : null;
      await approvalMessage?.edit({ embeds: [applicationEmbed(rejected).setTitle("파트너 신청 거절")], components: [] }).catch(() => null);
      const user = await context.client.users.fetch(rejected.requesterId).catch(() => null);
      await user?.send("파트너 신청이 거절되었습니다.").catch(() => null);
    }
    return rejected;
  }

  async function getByChannel(guildId, channelId) {
    const current = state(guildId);
    return (current.partners || []).find((item) => item.status === "active" && item.channelId === channelId) || null;
  }

  async function saveLatestMessage(guildId, channelId) {
    const guild = await context.client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return null;
    const messages = await channel.messages.fetch({ limit: 1 });
    const message = messages.first();
    if (!message) return null;
    const snapshot = {
      id: message.id,
      content: text(message.content, "", 2000),
      embeds: message.embeds.slice(0, 10).map((embed) => embed.toJSON()),
      attachments: message.attachments.map((attachment) => ({
        url: attachment.url,
        name: attachment.name || "attachment"
      })).slice(0, 10),
      savedAt: nowIso()
    };
    await patch(guildId, (draft) => {
      const item = (draft.partners || []).find((entry) => entry.status === "active" && entry.channelId === channelId);
      if (item) item.promoMessage = snapshot;
    });
    return snapshot;
  }

  function normalizePromoWebhook(value) {
    try {
      const url = new URL(String(value || ""));
      if (url.protocol !== "https:" || !["discord.com", "discordapp.com"].includes(url.hostname) || !/^\/api\/webhooks\/\d+\/[^/]+$/.test(url.pathname)) return "";
      return url.toString();
    } catch {
      return "";
    }
  }

  async function invalidatePartner(guildId, partnerId) {
    const partner = (state(guildId).partners || []).find((item) => item.id === partnerId);
    if (!partner) return;
    await deletePartner(guildId, partnerId).catch(() => null);
  }

  async function sendPartnerMessage(guildId, partner) {
    const webhookUrl = normalizePromoWebhook(partner.promoWebhook);
    const promoMessage = partner.promoMessage;
    if (!promoMessage) return { sent: false, skipped: true };
    if (!webhookUrl) {
      await invalidatePartner(guildId, partner.id);
      return { sent: false, skipped: false, invalidated: true };
    }
    const payload = {
      content: promoMessage.content || undefined,
      embeds: promoMessage.embeds || [],
      files: (promoMessage.attachments || []).map((attachment) => ({ attachment: attachment.url, name: attachment.name })),
      allowedMentions: { parse: [] }
    };
    if (!payload.content && !payload.embeds.length && !payload.files.length) return { sent: false, skipped: true };
    try {
      const webhook = new WebhookClient({ url: webhookUrl });
      await webhook.send(payload);
      webhook.destroy();
      return { sent: true, skipped: false };
    } catch (error) {
      console.error(`[partner] promo webhook failed for ${guildId}/${partner.id}:`, error?.message || error);
      await invalidatePartner(guildId, partner.id);
      return { sent: false, skipped: false, invalidated: true };
    }
  }

  async function processDailyMessages() {
    const results = { sent: 0, invalidated: 0, skipped: 0 };
    for (const guild of context.client.guilds.cache.values()) {
      const current = state(guild.id);
      if (current.settings?.partner?.enabled === false) continue;
      for (const partner of (current.partners || []).filter((item) => item.status === "active" && item.promoWebhook && item.promoMessage)) {
        const result = await sendPartnerMessage(guild.id, partner);
        if (result.sent) results.sent += 1;
        else if (result.invalidated) results.invalidated += 1;
        else results.skipped += 1;
      }
    }
    return results;
  }

  async function handleMessage(message) {
    const current = state(message.guild.id);
    if (current.settings?.partner?.enabled === false) return false;
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
    if (partner.penaltyDate === today) return true;
    warningCount += 1;
    const durationMs = warningCount >= 2 ? 7 * DAY_MS : DAY_MS;
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    await member?.timeout(durationMs, "파트너 채널 전체 멘션 제재").catch(() => null);
    await member?.send(`파트너 채널에서 하루 2회 이상 전체 멘션을 사용해 ${warningCount >= 2 ? "7일" : "1일"} 타임아웃이 적용되었습니다.`).catch(() => null);
    await patch(message.guild.id, (draft) => {
      const item = draft.partners.find((entry) => entry.id === partner.id);
      if (item) { item.mentionDate = today; item.dailyMentionCount = nextCount; item.warningCount = warningCount; item.penaltyDate = today; }
    });
    return true;
  }

  async function listStale(guildId) {
    const cutoff = Date.now() - STALE_MS;
    return (state(guildId).partners || []).filter((partner) => partner.status === "active" && new Date(partner.lastMessageAt || partner.approvedAt).getTime() < cutoff);
  }

  async function issueBannerLicense(guildId, issuerUserId, durationDays, issuerPlan = "") {
    const serviceLicense = await context.services.licenses.getActiveByGuild(guildId);
    const plan = serviceLicense?.plan || issuerPlan;
    if (!serviceLicense && String(guildId) !== String(context.config.allowedGuildId)) {
      throw new Error("활성 서비스 라이선스가 필요합니다.");
    }
    return context.services.licenses.issueBanner({
      durationDays,
      issuerGuildId: guildId,
      issuerUserId,
      issuerPlan: plan
    });
  }

  async function createBanner(guildId, { licenseKey, serverName, serverLink, promoWebhook, recipientUserId }) {
    const current = state(guildId);
    const settings = current.settings?.partner?.banner;
    if (!settings?.enabled || !settings.categoryId) throw new Error("상단배너 기능 또는 배너 카테고리가 설정되지 않았습니다.");
    const license = await context.services.licenses.activateBanner(licenseKey, guildId, recipientUserId);
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
    await channel.send(bannerComponents(settings, {
      serverName: text(serverName, "-", 80),
      serverLink: text(serverLink, "-", 500),
      promoWebhook: text(promoWebhook, "-", 500)
    }));
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

  return { syncConditionsMessage, syncBannerMessage, createApplication, approve, reject, handleMessage, getByChannel, saveLatestMessage, processDailyMessages, listStale, deletePartner, issueBannerLicense, createBanner, cleanupExpiredBanners };
}

export { conditionComponents, bannerComponents };
