import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleGuildCreate(guild, context) {
  if (!isAllowedGuild(context, guild.id)) {
    await guild.leave().catch(() => null);
    return;
  }

  await context.services.honeypot.syncStatusMessage(guild.id).catch(() => null);
}
