import { AdminControlModel } from "../database/models/adminControl.js";

const DEFAULT_CONTROL = { featureBans: {}, otherCommandsEnabled: true };

function toBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => toBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "on", "yes", "enabled"].includes(normalized)) return true;
  if (["false", "0", "off", "no", "disabled", ""].includes(normalized)) return false;
  return fallback;
}

export function createAdminControlService() {
  async function get() {
    const doc = await AdminControlModel.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global", ...DEFAULT_CONTROL } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      featureBans: doc?.featureBans && typeof doc.featureBans === "object"
        ? Object.fromEntries(Object.entries(doc.featureBans).map(([key, value]) => [key, toBoolean(value)]))
        : {},
      otherCommandsEnabled: toBoolean(doc?.otherCommandsEnabled, true)
    };
  }

  async function update({ featureBans = {}, otherCommandsEnabled = true }) {
    const cleanBans = Object.fromEntries(Object.entries(featureBans).map(([key, value]) => [String(key), toBoolean(value)]));
    const doc = await AdminControlModel.findOneAndUpdate(
      { key: "global" },
      { $set: { featureBans: cleanBans, otherCommandsEnabled: toBoolean(otherCommandsEnabled, true) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      featureBans: doc?.featureBans && typeof doc.featureBans === "object"
        ? Object.fromEntries(Object.entries(doc.featureBans).map(([key, value]) => [key, toBoolean(value)]))
        : cleanBans,
      otherCommandsEnabled: toBoolean(doc?.otherCommandsEnabled, true)
    };
  }

  return { get, update };
}
