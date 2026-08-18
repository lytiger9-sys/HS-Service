import express from "express";
import {
  clearLicenseAdmin,
  isLicenseAdmin,
  isLicenseAdminConfigured,
  markLicenseAdmin,
  requireLicenseAdmin,
  verifyLicenseAdmin
} from "../lib/licenseAuth.js";
import { PLAN_TAB_LABELS } from "../../src/config/plans.js";

function toBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => toBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "on", "yes", "enabled"].includes(normalized)) return true;
  if (["false", "0", "off", "no", "disabled", ""].includes(normalized)) return false;
  return fallback;
}

function wantsJson(req) {
  const requestedWith = String(req.get("X-Requested-With") || "").toLowerCase();
  const accept = String(req.get("Accept") || "").toLowerCase();
  return requestedWith === "fetch" || requestedWith === "xmlhttprequest" || accept.includes("application/json");
}

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
      const control = await context.services.adminControl.get();
      const featureControls = Object.entries(PLAN_TAB_LABELS).filter(([id]) => id !== "overview").map(([id, label]) => ({ id, label, banned: toBoolean(control.featureBans?.[id]) }));
      return res.render("license-dashboard", {
        title: "라이선스 관리",
        botName: context.config.botName,
        licenses: licenses.filter((license) => license.kind !== "banner"),
        issuedKeys: req.query.keys ? String(req.query.keys).split("\n").filter(Boolean) : [],
        featureControls,
        otherCommandsEnabled: control.otherCommandsEnabled,
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
      const keys = issued.map((entry) => entry.key);
      return wantsJson(req)
        ? res.json({ ok: true, message: `${keys.length}개의 라이선스가 발급되었습니다.`, keys })
        : res.redirect(`/license/dashboard?keys=${encodeURIComponent(keys.join("\n"))}`);
    } catch (error) {
      return wantsJson(req)
        ? res.status(400).json({ ok: false, message: error.message || "라이선스 발급에 실패했습니다." })
        : res.redirect(`/license/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  });

  router.post("/feature-control", async (req, res, next) => {
    try {
      const featureBans = Object.fromEntries(Object.keys(PLAN_TAB_LABELS).filter((id) => id !== "overview").map((id) => [id, !toBoolean(req.body[`feature_${id}`])]));
      const saved = await context.services.adminControl.update({ featureBans, otherCommandsEnabled: toBoolean(req.body.otherCommandsEnabled) });
      const message = "점검 모드 설정이 저장되었습니다.";
      return wantsJson(req) ? res.json({ ok: true, message, featureBans: saved.featureBans, otherCommandsEnabled: saved.otherCommandsEnabled }) : res.redirect("/license/dashboard");
    } catch (error) {
      return wantsJson(req)
        ? res.status(400).json({ ok: false, message: error.message || "점검 모드 저장에 실패했습니다." })
        : res.redirect(`/license/dashboard?error=${encodeURIComponent(error.message)}`);
    }
  });

  router.post("/:id/work-stop", async (req, res, next) => {
    try {
      const stopped = String(req.body.stopped || "true") !== "false";
      const updated = await context.services.licenses.setWorkStopped(req.params.id, stopped);
      if (!updated) {
        const message = "활성화된 서버 라이센스만 작업중지할 수 있습니다.";
        return wantsJson(req) ? res.status(400).json({ ok: false, message }) : res.redirect(`/license/dashboard?error=${encodeURIComponent(message)}`);
      }
      return wantsJson(req) ? res.json({ ok: true, message: stopped ? "작업이 중지되었습니다." : "작업이 재개되었습니다." }) : res.redirect("/license/dashboard");
    } catch (error) {
      return wantsJson(req) ? res.status(400).json({ ok: false, message: error.message || "작업 상태 변경에 실패했습니다." }) : next(error);
    }
  });

  router.post("/:id/revoke", async (req, res, next) => {
    try {
      const revoked = await context.services.licenses.revoke(req.params.id);
      if (!revoked) {
        const message = "이미 폐기되었거나 사용할 수 없는 라이선스입니다.";
        return wantsJson(req) ? res.status(400).json({ ok: false, message }) : res.redirect(`/license/dashboard?error=${encodeURIComponent(message)}`);
      }
      return wantsJson(req) ? res.json({ ok: true, message: "라이선스가 폐기되었습니다." }) : res.redirect("/license/dashboard");
    } catch (error) {
      return wantsJson(req) ? res.status(400).json({ ok: false, message: error.message || "라이선스 폐기에 실패했습니다." }) : next(error);
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
