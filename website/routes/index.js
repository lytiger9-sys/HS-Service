import express from "express";
import { buildDashboardViewModel } from "../lib/dashboardData.js";
import { getAccessMessage, getAllowedGuild, resolveDashboardAccess } from "../lib/dashboardAccess.js";
import { getPlanDefinition, PLAN_LABELS, PLAN_TAB_LABELS } from "../../src/config/plans.js";

function getActiveLicenseId(req) {
  return req.session?.activeLicenseId || "";
}

function renderActivation(res, context, message = "") {
  return res.render("activation", {
    title: "HS Service 시작하기",
    botName: context.config.botName,
    message,
    currentUser: res.locals.currentUser
  });
}

export function createIndexRouter(context) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      if (res.locals.isAuthenticated) {
        const sessionLicense = req.session?.activeLicenseId && req.session?.activeGuildId
          ? await context.services.licenses.getActiveById(req.session.activeLicenseId, req.session.activeGuildId)
          : null;
        const access = await resolveDashboardAccess(context, req.user?.id, sessionLicense ? req.session.activeGuildId : undefined);
        if (access.allowed) {
          const viewModel = await buildDashboardViewModel(context, access.guild, access.plan);
          const requestedSection = typeof req.query.section === "string" ? req.query.section : "";
          const activeSection = viewModel.sections.some((section) => section.id === requestedSection)
            ? requestedSection
            : "overview";
          return res.render("dashboard", {
            ...viewModel,
            currentUser: req.user,
            activeSection,
            saved: req.query.saved || "",
            issuedBannerKey: req.query.bannerKey || "",
            bannerError: req.query.bannerError || ""
          });
        }
        if (access.status === 503 || access.status === 404) {
          return res.status(access.status).render("error", {
            title: "대시보드를 열 수 없습니다.",
            message: getAccessMessage(access)
          });
        }
      }

      const activeLicense = getActiveLicenseId(req)
        ? await context.services.licenses.getActiveById(getActiveLicenseId(req), req.session.activeGuildId)
        : null;
      if (!activeLicense) {
        if (req.session) {
          delete req.session.activeLicenseId;
          delete req.session.activeGuildId;
        }
        return renderActivation(res, context, req.query.error || "");
      }

      const plan = getPlanDefinition(activeLicense.plan);
      const tabs = plan.tabs.filter((id) => id !== "honeypot").map((id) => ({ id, label: PLAN_TAB_LABELS[id] || id }));
      const requestedTab = typeof req.query.tab === "string" ? req.query.tab : "overview";
      const activeTab = tabs.some((tab) => tab.id === requestedTab) ? requestedTab : "overview";
      return res.render("plan-dashboard", {
        title: `${plan.label} 플랜 대시보드`,
        botName: context.config.botName,
        currentUser: req.user || null,
        license: activeLicense,
        plan,
        tabs,
        activeTab,
        planLabels: PLAN_LABELS
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/activate", async (req, res, next) => {
    try {
      const guildId = String(req.body.guildId || "").trim();
      const licenseKey = String(req.body.licenseKey || "").trim();
      if (!/^\d{15,22}$/.test(guildId)) {
        return renderActivation(res, context, "올바른 Discord 서버 ID를 입력하세요.");
      }
      const guild = await context.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) {
        return renderActivation(res, context, "봇이 해당 서버에 참여하고 있지 않습니다.");
      }
      const license = await context.services.licenses.activate(licenseKey, guildId);
      if (!license) {
        return renderActivation(res, context, "라이선스 키가 유효하지 않거나 이미 사용·폐기·만료되었습니다.");
      }
      req.session.activeLicenseId = String(license._id);
      req.session.activeGuildId = guildId;
      await Promise.resolve(context.updatePresence?.()).catch(() => null);
      return res.redirect("/");
    } catch (error) {
      return next(error);
    }
  });

  router.post("/license/switch", async (req, res, next) => {
    try {
      delete req.session.activeLicenseId;
      delete req.session.activeGuildId;
      return res.redirect("/");
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
