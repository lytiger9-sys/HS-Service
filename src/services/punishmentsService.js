import { randomUUID } from "node:crypto";

export function createPunishmentsService(context, guildState) {
  async function addPunishment(guildId, punishment) {
    const record = {
      id: randomUUID(),
      type: String(punishment.type ?? "timeout"),
      memberId: punishment.memberId ?? "",
      memberTag: punishment.memberTag ?? "",
      moderatorId: punishment.moderatorId ?? "",
      moderatorTag: punishment.moderatorTag ?? "",
      reason: punishment.reason ?? "",
      durationMinutes: Number(punishment.durationMinutes ?? 0),
      source: punishment.source ?? "bot",
      channelId: punishment.channelId ?? "",
      createdAt: new Date().toISOString(),
      expiresAt: punishment.expiresAt ?? null
    };

    await guildState.patch(guildId, (guild) => {
      guild.punishments.unshift(record);
      return record;
    });

    return record;
  }

  async function listPunishments(guildId, memberId = null) {
    await guildState.ensure(guildId);
    const punishments = guildState.snapshot(guildId).punishments;
    return memberId ? punishments.filter((entry) => entry.memberId === memberId) : punishments.slice();
  }

  async function clearPunishments(guildId) {
    return guildState.patch(guildId, (guild) => {
      guild.punishments = [];
      return guild.punishments;
    });
  }

  return {
    addPunishment,
    listPunishments,
    clearPunishments
  };
}
