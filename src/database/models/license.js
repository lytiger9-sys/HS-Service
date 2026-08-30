import mongoose from "mongoose";
import { PLAN_IDS } from "../../config/plans.js";

const { Schema, model, models } = mongoose;
// 신규 발급은 현재 3개 플랜만 허용합니다. 남아 있는 Enterprise 라이선스는
// Pro 전환이 끝날 때까지 조회와 상태 갱신을 위해 임시로 허용합니다.
const LICENSE_PLAN_IDS = [...PLAN_IDS, "enterprise"];

const licenseSchema = new Schema(
  {
    key: { type: String, default: "", unique: true, sparse: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    keyLast4: { type: String, required: true },
    plan: { type: String, required: true, enum: LICENSE_PLAN_IDS },
    kind: { type: String, required: true, enum: ["service", "banner"], default: "service", index: true },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    status: { type: String, required: true, enum: ["available", "active", "revoked", "expired"], default: "available", index: true },
    assignedGuildId: { type: String, default: "", index: true },
    issuerGuildId: { type: String, default: "", index: true },
    issuerUserId: { type: String, default: "" },
    recipientUserId: { type: String, default: "" },
    activatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    workStopped: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: "license-admin" }
  },
  { versionKey: false, minimize: false }
);

export const LicenseModel = models.License || model("License", licenseSchema);
