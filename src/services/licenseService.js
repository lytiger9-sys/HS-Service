import crypto from "node:crypto";
import { LicenseModel } from "../database/models/license.js";
import { PLAN_IDS } from "../config/plans.js";

export function normalizePlan(plan) {
  return PLAN_IDS.has(plan) ? plan : "free";
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

    async issue({ plan, durationDays, createdBy = "license-admin" }) {
      const normalizedPlan = normalizePlan(plan);
      const days = normalizeDurationDays(durationDays);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const plainKey = createPlainKey();
        try {
          await LicenseModel.create({
            keyHash: hashKey(plainKey),
            keyLast4: plainKey.slice(-4),
            plan: normalizedPlan,
            durationDays: days,
            createdBy
          });
          return { key: plainKey, plan: normalizedPlan, durationDays: days };
        } catch (error) {
          if (error?.code !== 11000 || attempt === 4) throw error;
        }
      }
      throw new Error("라이선스 키 생성에 실패했습니다.");
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
      if (!/^HS-[A-Z0-9]{6}(?:-[A-Z0-9]{6}){2}$/.test(normalizedKey)) return null;
      const license = await LicenseModel.findOne({ keyHash: hashKey(normalizedKey) });
      if (!license) return null;
      refreshExpiredStatus(license);
      if (license.isModified("status")) await license.save();
      return license;
    },

    async activate(key, guildId) {
      const license = await this.findByKey(key);
      if (!license || license.status !== "available") return null;
      const now = new Date();
      license.status = "active";
      license.assignedGuildId = String(guildId);
      license.activatedAt = now;
      license.expiresAt = new Date(now.getTime() + license.durationDays * 24 * 60 * 60 * 1000);
      await license.save();
      return license.toObject();
    }
  };
}

export { hashKey };
