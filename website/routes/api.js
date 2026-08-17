import express from "express";
import { getAccessMessage, resolveDashboardAccess } from "../lib/dashboardAccess.js";
import { parseTicketSettingsBody } from "../../src/shared/ticket.js";
import { canUseFeature, featureDeniedMessage } from "../../src/shared/planAccess.js";

function readBoolean(value) {
  return value === "on" || value === "true" || value === "1";
}

function readNumber(value, fallback = 0, min = -Infinity, max = Infinity) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function readText(value, fallback = "", maxLength = 2000) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, maxLength);
}

function readDiscordId(value) {
  const id = readText(value, "", 22);
  return /^\d{15,22}$/.test(id) ? id : "";
}

function splitLines(value, maxItems = 100, maxLength = 100) {
  return String(value ?? "")
    .split(/\r?\n|,/g)
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function wantsJson(req) {
  return req.get("X-Requested-With") === "fetch" || req.accepts(["json", "html"]) === "json";
}

function featureForSection(section) {
  const map = { welcome: "welcome", ticket: "ticket", security: "security", notice: "notice", polls: "polls", partner: "partner" };
  return map[section] || null;
}

async function requireFeature(context, guildId, feature) {
  if (!feature) return { allowed: true };
  const access = await canUseFeature(context, guildId, feature);
  return { ...access, allowed: access.featureAllowed, message: featureDeniedMessage(feature) };
}

function saveResponse(res, req, { section, message = "저장되었습니다." }) {
  const nextSection = section === "staff" ? "administrators" : section;
  if (wantsJson(req)) {
    return res.json({ ok: true, section: nextSection, message });
  }

  return res.redirect(nextSection === "administrators" ? "/?section=administrators" : `/?section=${nextSection}`);
}

function sectionPayload(section, body) {
  if (section === "welcome") {
    return {
      welcome: {
        enabled: readBoolean(body.welcomeEnabled),
        channelId: readDiscordId(body.welcomeChannelId),
        errorChannelId: readDiscordId(body.welcomeErrorChannelId),
        embedTitle: readText(body.welcomeEmbedTitle, "", 256),
        embedDescription: readText(body.welcomeEmbedDescription, "", 4000),
        embedColor: /^#[0-9a-f]{6}$/i.test(body.welcomeEmbedColor || "") ? body.welcomeEmbedColor : "#101010",
        dmTitle: readText(body.welcomeDmTitle, "", 256),
        dmMessage: readText(body.welcomeDmMessage, "", 4000),
        dmColor: /^#[0-9a-f]{6}$/i.test(body.welcomeDmColor || "") ? body.welcomeDmColor : "#1f1f1f"
      }
    };
  }

  if (section === "ticket") {
    return {
      ticket: parseTicketSettingsBody(body)
    };
  }

  if (section === "staff") {
    return {
      staff: {
        enabled: readBoolean(body.staffEnabled),
        channelId: readDiscordId(body.staffChannelId),
        embedTitle: readText(body.staffEmbedTitle, "", 256),
        embedDescription: readText(body.staffEmbedDescription, "", 4000),
        buttonLabel: readText(body.staffButtonLabel, "출퇴근", 80)
      }
    };
  }

  if (section === "security") {
    return {
      security: {
        enabled: readBoolean(body.securityEnabled),
        massMentionEnabled: body.massMentionEnabled === undefined ? true : readBoolean(body.massMentionEnabled),
        spamEnabled: body.spamEnabled === undefined ? true : readBoolean(body.spamEnabled),
        profanityEnabled: body.profanityEnabled === undefined ? true : readBoolean(body.profanityEnabled),
        inviteEnabled: body.inviteEnabled === undefined ? true : readBoolean(body.inviteEnabled),
        massMentionTimeoutMinutes: readNumber(body.massMentionTimeoutMinutes, 10, 0, 10080),
        spamTimeoutMinutes: readNumber(body.spamTimeoutMinutes, 10, 0, 10080),
        profanityTimeoutMinutes: readNumber(body.profanityTimeoutMinutes, 10, 0, 10080),
        inviteTimeoutMinutes: readNumber(body.inviteTimeoutMinutes, 10, 0, 10080),
        spamWindowSeconds: readNumber(body.spamWindowSeconds, 12, 1, 3600),
        spamRepeatThreshold: readNumber(body.spamRepeatThreshold, 3, 2, 100),
        profanityWords: splitLines(body.profanityWords, 200, 80)
      }
    };
  }

  if (section === "assignment") {
    return {
      assignment: {
        enabled: readBoolean(body.assignmentEnabled),
        channelId: readDiscordId(body.assignmentChannelId),
        roleId: readDiscordId(body.assignmentRoleId)
      }
    };
  }

  if (section === "voice") {
    return {
      voice: {
        enabled: readBoolean(body.voiceEnabled),
        categoryId: readDiscordId(body.voiceCategoryId),
        defaultName: readText(body.voiceDefaultName, "임시 채널", 100),
        maxUsers: readNumber(body.voiceMaxUsers, 0, 0, 99)
      }
    };
  }

  if (section === "honeypot") {
    return {
      honeypot: {
        enabled: readBoolean(body.honeypotEnabled),
        channelId: readDiscordId(body.honeypotChannelId),
        logChannelId: readDiscordId(body.honeypotLogChannelId)
      }
    };
  }

  if (section === "notice") {
    return {
      notice: {
        enabled: readBoolean(body.noticeEnabled),
        content: readText(body.noticeContent, "", 4000),
        updatedAt: new Date().toISOString()
      }
    };
  }

  if (section === "polls") {
    return {
      polls: {
        enabled: readBoolean(body.pollsEnabled)
      }
    };
  }

    if (section === "logs") {
    return {
      logs: {
        enabled: readBoolean(body.logsEnabled),
        moderationChannelId: readDiscordId(body.logModerationChannelId),
        securityChannelId: readDiscordId(body.logSecurityChannelId),
        serverChannelId: readDiscordId(body.logServerChannelId),
        voteChannelId: readDiscordId(body.logVoteChannelId),
        systemChannelId: readDiscordId(body.logSystemChannelId)
      }
    };
  }
  if (section === "partner") {
    return {
      partner: {
        enabled: readBoolean(body.partnerEnabled),
        conditionsChannelId: readDiscordId(body.partnerConditionsChannelId),
        approvalChannelId: readDiscordId(body.partnerApprovalChannelId),
        partnerCategoryId: readDiscordId(body.partnerCategoryId),
        namePrefix: readText(body.partnerNamePrefix, "", 30),
        nameSuffix: readText(body.partnerNameSuffix, "", 30),
        nameEmoji: readText(body.partnerNameEmoji, "", 8),
        embedTitle: readText(body.partnerEmbedTitle, "파트너 모집", 256),
        embedDescription: readText(body.partnerEmbedDescription, "", 4000),
        embedColor: /^#[0-9a-f]{6}$/i.test(body.partnerEmbedColor || "") ? body.partnerEmbedColor : "#3a7da8",
        buttonLabel: readText(body.partnerButtonLabel, "파트너 신청", 80),
        banner: {
          enabled: readBoolean(body.bannerEnabled),
          categoryId: readDiscordId(body.bannerCategoryId),
          namePrefix: readText(body.bannerNamePrefix, "", 30),
          nameSuffix: readText(body.bannerNameSuffix, "", 30),
          nameEmoji: readText(body.bannerNameEmoji, "", 8),
          embedTitle: readText(body.bannerEmbedTitle, "상단 배너", 256),
          embedDescription: readText(body.bannerEmbedDescription, "", 4000),
          embedColor: /^#[0-9a-f]{6}$/i.test(body.bannerEmbedColor || "") ? body.bannerEmbedColor : "#b89968"
        }
      }
    };
  }
  return null;

}

export function createApiRouter(context) {
  const router = express.Router();

  router.post("/:guildId/settings/:section", async (req, res, next) => {
    try {
      const { guildId, section } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed) {
        return res.status(access.status).send(getAccessMessage(access));
      }

      if (guildId !== access.guild.id) {
        return res.status(403).send("접근할 수 없는 서버입니다.");
      }
      const featureAccess = await requireFeature(context, guildId, featureForSection(section));
      if (!featureAccess.allowed) return res.status(403).send(featureAccess.message);

      const payload = sectionPayload(section, req.body);
      if (!payload) {
        return res.status(400).send("지원하지 않는 섹션입니다.");
      }

      await context.services.settings.updateSettings(guildId, payload);

      if (section === "honeypot") {
        await context.services.honeypot.syncStatusMessage(guildId).catch(() => null);
      }

      if (section === "staff") {
        await context.services.staff.syncStaffBoard(guildId).catch(() => null);
      }

      if (section === "ticket") {
        await context.services.tickets.syncBoard(guildId).catch(() => null);
      }
      if (section === "partner") {
        await context.services.partners.syncConditionsMessage(guildId).catch(() => null);
      }

      return saveResponse(res, req, { section });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:guildId/reset", async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed) {
        return res.status(access.status).send(getAccessMessage(access));
      }

      if (guildId !== access.guild.id) {
        return res.status(403).send("접근할 수 없는 서버입니다.");
      }

      await context.services.guildState.reset(guildId);

      if (wantsJson(req)) {
        return res.json({ ok: true, section: "overview", message: "서버 데이터가 기본값으로 초기화되었습니다." });
      }

      return res.redirect("/?section=overview");
    } catch (error) {
      next(error);
    }
  });

  router.post("/:guildId/partner/:partnerId/delete", async (req, res, next) => {
    try {
      const { guildId, partnerId } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed || guildId !== access.guild.id) return res.status(403).send("접근할 수 없는 서버입니다.");
      const featureAccess = await requireFeature(context, guildId, "partner");
      if (!featureAccess.allowed) return res.status(403).send(featureAccess.message);
      await context.services.partners.deletePartner(guildId, partnerId);
      return wantsJson(req) ? res.json({ ok: true }) : res.redirect("/?section=partner");
    } catch (error) {
      next(error);
    }
  });

  router.post("/:guildId/partner/banner", async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed || guildId !== access.guild.id) return res.status(403).send("접근할 수 없는 서버입니다.");
      const featureAccess = await requireFeature(context, guildId, "partner");
      if (!featureAccess.allowed) return res.status(403).send(featureAccess.message);
      await context.services.partners.createBanner(guildId, {
        licenseKey: String(req.body.bannerLicenseKey || "").trim(),
        serverName: String(req.body.bannerServerName || "").trim(),
        serverLink: String(req.body.bannerServerLink || "").trim(),
        promoWebhook: String(req.body.bannerPromoWebhook || "").trim()
      });
      return wantsJson(req) ? res.json({ ok: true }) : res.redirect("/?section=partner");
    } catch (error) {
      return res.redirect(`/?section=partner&error=${encodeURIComponent(error.message)}`);
    }
  });

  router.post("/:guildId/ticket/publish", async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed) {
        return res.status(access.status).send(getAccessMessage(access));
      }

      if (guildId !== access.guild.id) {
        return res.status(403).send("접근할 수 없는 서버입니다.");
      }
      const featureAccess = await requireFeature(context, guildId, "ticket");
      if (!featureAccess.allowed) return res.status(403).send(featureAccess.message);

      const message = await context.services.tickets.syncBoard(guildId);
      if (!message) {
        return res.status(400).json({
          ok: false,
          message: "티켓 게시 채널이 없거나 티켓 기능이 꺼져 있어 전송할 수 없습니다."
        });
      }

      if (wantsJson(req)) {
        return res.json({ ok: true, section: "ticket", message: "티켓 보드를 전송했습니다." });
      }

      return res.redirect("/?section=ticket");
    } catch (error) {
      next(error);
    }
  });

  router.post("/:guildId/polls", async (req, res, next) => {
    try {
      const { guildId } = req.params;
      const access = await resolveDashboardAccess(context, req.user?.id);
      if (!access.allowed) {
        return res.status(access.status).send(getAccessMessage(access));
      }

      if (guildId !== access.guild.id) {
        return res.status(403).send("접근할 수 없는 서버입니다.");
      }
      const featureAccess = await requireFeature(context, guildId, "polls");
      if (!featureAccess.allowed) return res.status(403).send(featureAccess.message);

      const poll = await context.services.polls.createPoll(guildId, {
        channelId: req.body.pollChannelId || "",
        question: req.body.pollQuestion || "",
        description: req.body.pollDescription || "",
        options: splitLines(req.body.pollOptions),
        freeTextEnabled: readBoolean(req.body.pollFreeText),
        createdBy: req.body.createdBy || "",
        createdByTag: req.body.createdByTag || ""
      });

      if (poll.channelId) {
        await context.services.polls.publishPoll(guildId, poll.id, poll.channelId);
      }

      return res.redirect("/?section=polls&saved=1");
    } catch (error) {
      next(error);
    }
  });

  return router;
}
