import { createDefaultGuildState } from "../config/defaults.js";

export function createGuildStateService(context) {
  async function ensure(guildId) {
    return context.store.ensureGuild(guildId, createDefaultGuildState);
  }

  async function patch(guildId, updater) {
    return context.store.patchGuild(guildId, updater, createDefaultGuildState);
  }

  async function reset(guildId) {
    return context.store.resetGuild(guildId, createDefaultGuildState);
  }

  function snapshot(guildId) {
    return context.store.snapshotGuild(guildId);
  }

  return {
    ensure,
    patch,
    reset,
    snapshot
  };
}
