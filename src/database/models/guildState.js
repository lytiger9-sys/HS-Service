import mongoose from "mongoose";
import { createDefaultGuildState } from "../../config/defaults.js";

const { Schema, model, models } = mongoose;

const guildStateSchema = new Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    settings: { type: Schema.Types.Mixed, default: () => createDefaultGuildState().settings },
    notes: { type: [Schema.Types.Mixed], default: () => [] },
    punishments: { type: [Schema.Types.Mixed], default: () => [] },
    joinOrder: { type: [Schema.Types.Mixed], default: () => [] },
    tickets: { type: Schema.Types.Mixed, default: () => ({}) },
    polls: { type: Schema.Types.Mixed, default: () => ({}) },
    tempChannels: { type: Schema.Types.Mixed, default: () => ({}) }
  },
  {
    versionKey: false,
    minimize: false
  }
);

export const GuildStateModel = models.GuildState || model("GuildState", guildStateSchema);
