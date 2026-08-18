import express from "express";
import {
  clearLicenseAdmin,
  isLicenseAdmin,
  isLicenseAdminConfigured,
  markLicenseAdmin,
  requireLicenseAdmin,
  verifyLicenseAdmin
} from "../lib/licenseAuth.js";

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function renderLogin(res, context, message = "") {
  return res.render("license-login", {
    title: "라이선스 관리자 로그인",
    botName: context.config.botName,
    configured: isLicenseAdminConfigured(context.config),
    message
  });
}

export function createLicenseRouter(context) {
  const router = express.Router();

  router.get(["/", "/login"], (req, res) => {
    if (isLicenseAdmin(req)) return res.redirect("/license/dashboard");
    return renderLogin(res, context);
  });

  router.post("/login", async (req, res, next) => {
    try {
      const id = String(req.body.licenseAdminId || "").trim();
      const password = String(req.body.licenseAdminPassword || "");
      if (!verifyLicenseAdmin(context.config, id, password)) {
        return renderLogin(res, context, "아이디 또는 비밀번호가 올바르지 않습니다.");
      }
      await regenerateSession(req);
      markLicenseAdmin(req);
      return res.redirect("/license/dashboard");
    } catch (error) {
      return next(error);
    }
  });

  router.use(requireLicenseAdmin);

  router.get("/dashboard", async (req, res, next) => {
    try {
      const licenses = await context.services.licenses.list();
      return res.render("license-dashboard", {
        title: "라이선스 관리",
        botName: context.config.botName,
        licenses: licenses.filter((license) => license.kind !== "banner"),
        issuedKeys: req.query.keys ? String(req.query.keys).split("\n").filter(Boolean) : [],
        errorMessage: req.query.error || ""
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/issue", async (req, res, next) => {
    try {
      const issued = await context.services.licenses.issue({
        plan: req.body.plan,
        durationDays: req.body.durationDays,
        count: req.body.count
      });
      return res.redirect(`/license/dashboard?keys=${encodeURIComponent(issued.map((entry) => entry.key).join("\n"))}`);
    } catch (error) {
      return res.redirect(`/license/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  });

  router.post("/:id/work-stop", async (req, res, next) => {
    try {
      const stopped = String(req.body.stopped || "true") !== "false";
      const updated = await context.services.licenses.setWorkStopped(req.params.id, stopped);
      if (!updated) return res.redirect("/license/dashboard?error=활성화된 서버 라이센스만 작업중지할 수 있습니다.");
      return res.redirect("/license/dashboard");
    } catch (error) { return next(error); }
  });

  router.post("/:id/revoke", async (req, res, next) => {
    try {
      const revoked = await context.services.licenses.revoke(req.params.id);
      if (!revoked) {
        return res.redirect("/license/dashboard?error=이미%20폐기되었거나%20사용할%20수%20없는%20라이선스입니다.");
      }
      return res.redirect("/license/dashboard");
    } catch (error) {
      return next(error);
    }
  });

  router.post("/logout", (req, res, next) => {
    clearLicenseAdmin(req);
    req.session.save((error) => {
      if (error) return next(error);
      return res.redirect("/license/login");
    });
  });

  return router;
}
