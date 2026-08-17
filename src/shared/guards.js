import { PermissionFlagsBits } from "discord.js";

const PENDING_GUILD_GRACE_MS = 15 * 60 * 1000;
const pendingGuildTimers = new WeakMap();

export async function isAllowedGuild(context, guildId) {
  if (!guildId) return false;
  if (String(guildId) === String(context.config.allowedGuildId)) return true;
  const license = await context.services?.licenses?.getActiveByGuild(guildId).catch(() => null);
  return Boolean(license);
}

export function scheduleGuildValidation(context, guild) {
  if (!guild || !context) return;
  const previous = pendingGuildTimers.get(context)?.get(guild.id);
  if (previous) clearTimeout(previous);
  const timers = pendingGuildTimers.get(context) || new Map();
  const timer = setTimeout(async () => {
    if (!(await isAllowedGuild(context, guild.id))) await guild.leave().catch(() => null);
    timers.delete(guild.id);
  }, PENDING_GUILD_GRACE_MS);
  timer.unref?.();
  timers.set(guild.id, timer);
  pendingGuildTimers.set(context, timers);
}

export function isAdministrator(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}
