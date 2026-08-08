import { PermissionFlagsBits } from "discord.js";

export function isAllowedGuild(context, guildId) {
  return Boolean(guildId) && guildId === context.config.allowedGuildId;
}

export function isAdministrator(member) {
  return Boolean(member?.permissions?.has(PermissionFlagsBits.Administrator));
}
