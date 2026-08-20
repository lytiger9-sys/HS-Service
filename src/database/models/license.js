import mongoose from "mongoose";
import { PLAN_IDS } from "../../config/plans.js";

const { Schema, model, models } = mongoose;

const licenseSchema = new Schema(
  {
    key: { type: String, default: "", unique: true, sparse: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    keyLast4: { type: String, required: true },
    plan: { type: String, required: true, enum: [...PLAN_IDS] },
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
