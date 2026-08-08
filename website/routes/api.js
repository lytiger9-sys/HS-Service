import express from "express";
import { getAccessMessage, resolveDashboardAccess } from "../lib/dashboardAccess.js";

function readBoolean(value) {
  return value === "on" || value === "true" || value === "1";
}

function readNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function splitLines(value) {
  return String(value ?? "")
    .split(/\r?\n|,/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sectionPayload(section, body) {
  if (section === "welcome") {
    return {
      welcome: {
        enabled: readBoolean(body.welcomeEnabled),
        channelId: body.welcomeChannelId || "",
        errorChannelId: body.welcomeErrorChannelId || "",
        embedTitle: body.welcomeEmbedTitle || "",
        embedDescription: body.welcomeEmbedDescription || "",
        embedColor: body.welcomeEmbedColor || "#101010",
        dmTitle: body.welcomeDmTitle || "",
        dmMessage: body.welcomeDmMessage || "",
        dmColor: body.welcomeDmColor || "#1f1f1f"
      }
    };
  }

  if (section === "ticket") {
    return {
      ticket: {
        enabled: readBoolean(body.ticketEnabled),
        categoryId: body.ticketCategoryId || "",
        logChannelId: body.ticketLogChannelId || "",
        channelPrefix: body.ticketPrefix || "ticket-"
      }
    };
  }

  if (section === "security") {
    return {
      security: {
        massMentionTimeoutMinutes: readNumber(body.massMentionTimeoutMinutes, 10),
        spamTimeoutMinutes: readNumber(body.spamTimeoutMinutes, 10),
        profanityTimeoutMinutes: readNumber(body.profanityTimeoutMinutes, 10),
        inviteTimeoutMinutes: readNumber(body.inviteTimeoutMinutes, 10),
        spamWindowSeconds: readNumber(body.spamWindowSeconds, 12),
        spamRepeatThreshold: readNumber(body.spamRepeatThreshold, 3),
        profanityWords: splitLines(body.profanityWords)
      }
    };
  }

  if (section === "assignment") {
    return {
      assignment: {
        channelId: body.assignmentChannelId || "",
        roleId: body.assignmentRoleId || ""
      }
    };
  }

  if (section === "voice") {
    return {
      voice: {
        categoryId: body.voiceCategoryId || "",
        defaultName: body.voiceDefaultName || "임시 채널",
        maxUsers: readNumber(body.voiceMaxUsers, 0)
      }
    };
  }

  if (section === "honeypot") {
    return {
      honeypot: {
        channelId: body.honeypotChannelId || "",
        logChannelId: body.honeypotLogChannelId || ""
      }
    };
  }

  if (section === "notice") {
    return {
      notice: {
        content: body.noticeContent || "",
        updatedAt: new Date().toISOString()
      }
    };
  }

  if (section === "logs") {
    return {
      logs: {
        welcomeChannelId: body.logWelcomeChannelId || "",
        ticketChannelId: body.logTicketChannelId || "",
        moderationChannelId: body.logModerationChannelId || "",
        securityChannelId: body.logSecurityChannelId || "",
        serverChannelId: body.logServerChannelId || "",
        voteChannelId: body.logVoteChannelId || "",
        systemChannelId: body.logSystemChannelId || ""
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
        return res.status(403).send("허용되지 않은 서버입니다.");
      }

      const payload = sectionPayload(section, req.body);
      if (!payload) {
        return res.status(400).send("지원하지 않는 섹션입니다.");
      }

      await context.services.settings.updateSettings(guildId, payload);

      if (section === "honeypot") {
        await context.services.honeypot.syncStatusMessage(guildId).catch(() => null);
      }

      return res.redirect(`/?section=${section}&saved=1`);
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
        return res.status(403).send("허용되지 않은 서버입니다.");
      }

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
