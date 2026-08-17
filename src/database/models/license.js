import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const licenseSchema = new Schema(
  {
    keyHash: { type: String, required: true, unique: true, index: true },
    keyLast4: { type: String, required: true },
    plan: { type: String, required: true, enum: ["basic", "pro", "enterprise"] },
    durationDays: { type: Number, required: true, min: 1, max: 3650 },
    status: { type: String, required: true, enum: ["available", "active", "revoked", "expired"], default: "available", index: true },
    assignedGuildId: { type: String, default: "", index: true },
    activatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: String, default: "license-admin" }
  },
  { versionKey: false, minimize: false }
);

export const LicenseModel = models.License || model("License", licenseSchema);
