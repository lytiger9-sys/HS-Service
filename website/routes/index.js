import express from "express";
import { buildDashboardViewModel } from "../lib/dashboardData.js";
import { getAccessMessage, getAllowedGuild, resolveDashboardAccess } from "../lib/dashboardAccess.js";

export function createIndexRouter(context) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      if (!res.locals.isAuthenticated) {
        const guildResult = await getAllowedGuild(context);
        return res.render("auth", {
          botName: context.config.botName,
          guildName: guildResult.guild?.name || "지정된 서버",
          message: req.query.auth === "failed" ? "Discord 인증에 실패했습니다." : ""
        });
      }

      const access = await resolveDashboardAccess(context, req.user?.id);
      if (access.status === 503 || access.status === 404) {
        return res.status(access.status).render("error", {
          title: "대시보드를 열 수 없습니다.",
          message: getAccessMessage(access)
        });
      }

      if (!access.allowed) {
        return res.status(403).render("forbidden", {
          botName: context.config.botName,
          guildName: access.guild?.name || "지정된 서버",
          currentUser: req.user,
          message: getAccessMessage(access)
        });
      }

      const viewModel = await buildDashboardViewModel(context, access.guild);
      const requestedSection = typeof req.query.section === "string" ? req.query.section : "";
      const activeSection = viewModel.sections.some((section) => section.id === requestedSection)
        ? requestedSection
        : "overview";

      return res.render("dashboard", {
        ...viewModel,
        currentUser: req.user,
        activeSection,
        saved: req.query.saved || ""
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
