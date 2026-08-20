import crypto from "node:crypto";
import { LicenseModel } from "../database/models/license.js";
import { PLAN_IDS } from "../config/plans.js";
import { planHasFeature } from "../shared/planAccess.js";

export function normalizePlan(plan) {
  return PLAN_IDS.has(plan) ? plan : "free";
}

function normalizeCount(value) {
  const count = Number(value ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("한 번에 1개에서 100개까지 생성할 수 있습니다.");
  return count;
}

function normalizeDurationDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new Error("라이선스 기간은 1일에서 3650일 사이의 정수여야 합니다.");
  }
  return days;
}

function createPlainKey() {
  const token = crypto.randomBytes(18).toString("base64url").toUpperCase();
  return `HS-${token.slice(0, 6)}-${token.slice(6, 12)}-${token.slice(12, 18)}`;
}

function hashKey(key) {
  return crypto.createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
}

function refreshExpiredStatus(license) {
  if (license.status === "active" && license.expiresAt && license.expiresAt <= new Date()) {
    license.status = "expired";
  }
  return license;
}

export function createLicenseService() {
  return {
    async countSupportedGuilds(guildIds = [], alwaysIncludeGuildIds = []) {
      const ids = [...new Set(guildIds.map((id) => String(id)).filter(Boolean))];
      const includedIds = new Set(alwaysIncludeGuildIds.map((id) => String(id)).filter(Boolean));
      if (!ids.length) return includedIds.size;
      const assignedGuildIds = await LicenseModel.distinct("assignedGuildId", {
        kind: "service",
        status: "active",
        assignedGuildId: { $in: ids }
      });
      return new Set([...assignedGuildIds.map(String), ...includedIds]).size;
    },

    async list() {
      const licenses = await LicenseModel.find({}).sort({ createdAt: -1 }).lean();
      const expiredIds = licenses
        .filter((license) => license.status === "active" && license.expiresAt && license.expiresAt <= new Date())
        .map((license) => license._id);
      if (expiredIds.length) {
        await LicenseModel.updateMany({ _id: { $in: expiredIds } }, { $set: { status: "expired" } });
      }
      return licenses.map((license) => refreshExpiredStatus(license));
    },

    async issue({ plan, durationDays, count = 1, createdBy = "license-admin" }) {
      const normalizedPlan = normalizePlan(plan);
      const days = normalizeDurationDays(durationDays);
      const total = normalizeCount(count);
      const issued = [];
      while (issued.length < total) {
        const plainKey = createPlainKey();
        try {
          await LicenseModel.create({ key: plainKey, keyHash: hashKey(plainKey), keyLast4: plainKey.slice(-4), plan: normalizedPlan, durationDays: days, createdBy });
          issued.push({ key: plainKey, plan: normalizedPlan, durationDays: days });
        } catch (error) {
          if (error?.code !== 11000) throw error;
        }
      }
      return issued;
    },

    async issueBanner({ durationDays, issuerGuildId, issuerUserId, issuerPlan }) {
      if (!planHasFeature(issuerPlan, "partner")) throw new Error("파트너 플랜에서만 상단배너 라이선스를 발급할 수 있습니다.");
      const days = normalizeDurationDays(durationDays);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const plainKey = createPlainKey();
        try {
          await LicenseModel.create({
            key: plainKey,
            keyHash: hashKey(plainKey),
            keyLast4: plainKey.slice(-4),
            plan: issuerPlan,
            kind: "banner",
            durationDays: days,
            issuerGuildId: String(issuerGuildId),
            issuerUserId: String(issuerUserId),
            createdBy: String(issuerUserId)
          });
          return { key: plainKey, kind: "banner", durationDays: days };
        } catch (error) {
          if (error?.code !== 11000 || attempt === 4) throw error;
        }
      }
      throw new Error("상단배너 라이선스 키 생성에 실패했습니다.");
    },

    async setWorkStopped(id, stopped) {
      return LicenseModel.findOneAndUpdate({ _id: id, kind: "service", status: "active" }, { $set: { workStopped: Boolean(stopped) } }, { new: true }).lean();
    },
    async isWorkStopped(guildId) {
      const license = await LicenseModel.findOne({ assignedGuildId: String(guildId), kind: "service", status: "active" }).select("workStopped").lean();
      return Boolean(license?.workStopped);
    },
    async revoke(id) {
      const result = await LicenseModel.findOneAndUpdate(
        { _id: id, status: { $in: ["available", "active"] } },
        { $set: { status: "revoked", revokedAt: new Date() } },
        { new: true }
      ).lean();
      return result;
    },

    async findByKey(key) {
      const normalizedKey = String(key || "").trim().toUpperCase();
      // createPlainKey() uses base64url, so a valid issued key may contain `_` or `-` inside a segment.
      if (!/^HS-[A-Z0-9_-]{6}(?:-[A-Z0-9_-]{6}){2}$/.test(normalizedKey)) return null;
      const license = await LicenseModel.findOne({ $or: [{ key: normalizedKey }, { keyHash: hashKey(normalizedKey) }] });
      if (!license) return null;
      refreshExpiredStatus(license);
      if (license.isModified("status")) await license.save();
      return license;
    },

    async getActiveByGuild(guildId) {
      const licenses = await LicenseModel.find({ assignedGuildId: String(guildId), kind: "service", status: "active" }).sort({ expiresAt: -1 });
      const license = licenses[0];
      if (!license) return null;
      refreshExpiredStatus(license);
      if (license.isModified("status")) await license.save();
      return license.status === "active" ? license.toObject() : null;
    },

    async getActiveById(id, guildId) {
      const license = await LicenseModel.findOne({ _id: id, assignedGuildId: String(guildId), kind: "service" });
      if (!license) return null;
      refreshExpiredStatus(license);
      if (license.isModified("status")) await license.save();
      return license.status === "active" ? license.toObject() : null;
    },

    async activate(key, guildId) {
      const license = await this.findByKey(key);
      if (!license || license.kind !== "service" || license.status !== "available") return null;
      const now = new Date();
      license.status = "active";
      license.assignedGuildId = String(guildId);
      // 최초 웹 등록 시점에만 타이머를 시작하며, 재조회·재로그인으로 연장하지 않습니다.
      license.activatedAt = license.activatedAt || now;
      license.expiresAt = license.expiresAt || new Date(license.activatedAt.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
      await license.save();
      return license.toObject();
    },

    async activateBanner(key, guildId, recipientUserId) {
      const license = await this.findByKey(key);
      if (!license || license.kind !== "banner" || license.status !== "available") return null;
      const now = new Date();
      license.status = "active";
      license.assignedGuildId = String(guildId);
      license.recipientUserId = String(recipientUserId || "");
      license.activatedAt = now;
      license.expiresAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
      await license.save();
      return license.toObject();
    }
  };
}

export { hashKey };
