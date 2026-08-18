import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const adminControlSchema = new Schema(
  {
    key: { type: String, unique: true, default: "global" },
    featureBans: { type: Schema.Types.Mixed, default: () => ({}) },
    otherCommandsEnabled: { type: Boolean, default: true }
  },
  { versionKey: false, minimize: false, timestamps: true }
);

export const AdminControlModel = models.AdminControl || model("AdminControl", adminControlSchema);
