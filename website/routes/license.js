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
import XLSX from "xlsx";

function toBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => toBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "on", "yes", "enabled"].includes(normalized)) return true;
  if (["false", "0", "off", "no", "disabled", ""].includes(normalized)) return false;
  return fallback;
}

function normalizeLicenseFilters(source = {}) {
  return {
    q: String(source.q || "").trim().toLowerCase(),
    plan: String(source.plan || "").trim().toLowerCase(),
    period: String(source.period || "").trim().toLowerCase(),
    status: String(source.status || "").trim().toLowerCase()
  };
}

function filterLicenses(licenses, filters) {
  return licenses.filter((license) => {
    const searchable = [license.key, license.keyLast4, license.assignedGuildId, license.plan, license.status]
      .filter(Boolean).join(" ").toLowerCase();
    if (filters.q && !searchable.includes(filters.q)) return false;
    if (filters.plan && license.plan !== filters.plan) return false;
    if (filters.status && license.status !== filters.status) return false;
    const days = Number(license.durationDays) || 0;
    if (filters.period === "under7" && days > 7) return false;
    if (filters.period === "8to30" && (days < 8 || days > 30)) return false;
    if (filters.period === "31to90" && (days < 31 || days > 90)) return false;
    if (filters.period === "over90" && days <= 90) return false;
    return true;
  });
}

function licenseDate(value) {
  return value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "-";
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

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
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
      await saveSession(req);
      return res.redirect("/license/dashboard");
    } catch (error) {
      return next(error);
    }
  });

  router.use(requireLicenseAdmin);

  router.get("/licenses.xlsx", async (req, res, next) => {
    try {
      const allLicenses = (await context.services.licenses.list()).filter((license) => license.kind !== "banner");
      const filters = normalizeLicenseFilters(req.query);
      const licenses = filterLicenses(allLicenses, filters);
      const rows = licenses.map((license) => ({
        "라이선스 키": license.key || `HS-••••-••••-${license.keyLast4 || ""}`,
        "플랜": license.plan || "-",
        "사용 기간(일)": license.durationDays || 0,
        "상태": license.status || "-",
        "연결 서버 ID": license.assignedGuildId || "-",
        "발급일": license.createdAt ? licenseDate(license.createdAt) : "-",
        "활성화일": license.activatedAt ? licenseDate(license.activatedAt) : "-",
        "만료일": licenseDate(license.expiresAt)
      }));
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(workbook, worksheet, "라이선스 목록");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="hs-service-licenses-${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.send(buffer);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/dashboard", async (req, res, next) => {
    try {
      const allLicenses = await context.services.licenses.list();
      const filters = normalizeLicenseFilters(req.query);
      const licenses = filterLicenses(allLicenses.filter((license) => license.kind !== "banner"), filters);
      const control = await context.services.adminControl.get();
      const featureControls = Object.entries(PLAN_TAB_LABELS).filter(([id]) => id !== "overview").map(([id, label]) => ({ id, label, banned: toBoolean(control.featureBans?.[id]) }));
      return res.render("license-dashboard", {
        title: "라이선스 관리",
        botName: context.config.botName,
        licenses,
        licenseTotal: allLicenses.filter((license) => license.kind !== "banner").length,
        licenseFilters: filters,
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
