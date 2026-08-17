import { isAllowedGuild, scheduleGuildValidation } from "../../shared/guards.js";

export default async function handleGuildCreate(guild, context) {
  if (!(await isAllowedGuild(context, guild.id))) {
    scheduleGuildValidation(context, guild);
    return;
  }

  await context.services.honeypot.syncStatusMessage(guild.id).catch(() => null);
}
