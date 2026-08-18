import { AdminControlModel } from "../database/models/adminControl.js";

const DEFAULT_CONTROL = { featureBans: {}, otherCommandsEnabled: true };

export function createAdminControlService() {
  async function get() {
    const doc = await AdminControlModel.findOneAndUpdate(
      { key: "global" },
      { $setOnInsert: { key: "global", ...DEFAULT_CONTROL } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      featureBans: doc?.featureBans && typeof doc.featureBans === "object" ? doc.featureBans : {},
      otherCommandsEnabled: doc?.otherCommandsEnabled !== false
    };
  }

  async function update({ featureBans = {}, otherCommandsEnabled = true }) {
    const cleanBans = Object.fromEntries(Object.entries(featureBans).map(([key, value]) => [String(key), Boolean(value)]));
    const doc = await AdminControlModel.findOneAndUpdate(
      { key: "global" },
      { $set: { featureBans: cleanBans, otherCommandsEnabled: Boolean(otherCommandsEnabled) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return {
      featureBans: doc?.featureBans || cleanBans,
      otherCommandsEnabled: doc?.otherCommandsEnabled !== false
    };
  }

  return { get, update };
}
