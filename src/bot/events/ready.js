import { commandList } from "../commands/index.js";
import { isAllowedGuild, scheduleGuildValidation } from "../../shared/guards.js";

export default async function handleReady(client, context) {
  console.log(`[bot] logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    if (!(await isAllowedGuild(context, guild.id))) {
      scheduleGuildValidation(context, guild);
      continue;
    }
    await guild.commands.set(commandList.map((command) => command.data.toJSON())).catch(() => null);
    await context.services.honeypot.syncStatusMessage(guild.id).catch(() => null);
    await context.services.overviewChannels.syncGuild(guild).catch((error) => console.error(`[overview] sync failed for ${guild.id}:`, error));
  }

  const cleanupExpiredBanners = async () => {
    for (const guild of client.guilds.cache.values()) {
      await context.services.partners.cleanupExpiredBanners(guild.id).catch(() => null);
    }
  };
  await cleanupExpiredBanners();
  const cleanupTimer = setInterval(cleanupExpiredBanners, 60 * 60 * 1000);
  cleanupTimer.unref?.();
  await context.services.embeds.processSchedules().catch(() => null);
  const embedScheduleTimer = setInterval(() => void context.services.embeds.processSchedules().catch(() => null), 60 * 1000);
  embedScheduleTimer.unref?.();
}
