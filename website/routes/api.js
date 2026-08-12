import express from "express";
import { getAccessMessage, resolveDashboardAccess } from "../lib/dashboardAccess.js";
import { parseTicketSettingsBody } from "../../src/shared/ticket.js";

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

function wantsJson(req) {
  return req.get("X-Requested-With") === "fetch" || req.accepts(["json", "html"]) === "json";
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
      ticket: parseTicketSettingsBody(body)
    };
  }

  if (section === "staff") {
    return {
      staff: {
        enabled: readBoolean(body.staffEnabled),
        channelId: body.staffChannelId || "",
        embedTitle: body.staffEmbedTitle || "",
        embedDescription: body.staffEmbedDescription || "",
        buttonLabel: body.staffButtonLabel || "출퇴근"
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
        enabled: readBoolean(body.assignmentEnabled),
        channelId: body.assignmentChannelId || "",
        roleId: body.assignmentRoleId || ""
      }
    };
  }

  if (section === "voice") {
    return {
      voice: {
        enabled: readBoolean(body.voiceEnabled),
        categoryId: body.voiceCategoryId || "",
        defaultName: body.voiceDefaultName || "임시 채널",
        maxUsers: readNumber(body.voiceMaxUsers, 0)
      }
    };
  }

  if (section === "honeypot") {
    return {
      honeypot: {
        enabled: readBoolean(body.honeypotEnabled),
        channelId: body.honeypotChannelId || "",
        logChannelId: body.honeypotLogChannelId || ""
      }
    };
  }

  if (section === "notice") {
    return {
      notice: {
        enabled: readBoolean(body.noticeEnabled),
        content: body.noticeContent || "",
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
        return res.status(403).send("접근할 수 없는 서버입니다.");
      }

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
