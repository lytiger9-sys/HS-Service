import { ActivityType } from "discord.js";
import { commandList } from "../commands/index.js";
import { isAllowedGuild, scheduleGuildValidation } from "../../shared/guards.js";

export default async function handleReady(client, context) {
  console.log(`[bot] logged in as ${client.user.tag}`);

  const updatePresence = async () => {
    const supportedGuilds = await context.services.licenses.countSupportedGuilds(client.guilds.cache.keys(), [context.config.allowedGuildId]);
    client.user.setPresence({
      activities: [{ name: `Supporting ${supportedGuilds} servers`, type: ActivityType.Watching }],
      status: "online"
    });
  };
  context.updatePresence = updatePresence;
  await updatePresence().catch((error) => console.error("[bot] presence update failed:", error));
  const presenceTimer = setInterval(() => void updatePresence().catch((error) => console.error("[bot] presence update failed:", error)), 5 * 60 * 1000);
  presenceTimer.unref?.();

  const commandPayload = commandList.map((command) => command.data.toJSON());
  const commandNames = commandPayload.map((command) => command.name);
  const duplicateNames = commandNames.filter((name, index) => commandNames.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(`[commands] duplicate command names: ${[...new Set(duplicateNames)].join(", ")}`);
  }
  console.log(`[commands] preparing ${commandPayload.length} slash commands: ${commandNames.join(", ")}`);

  for (const guild of client.guilds.cache.values()) {
    if (!(await isAllowedGuild(context, guild.id))) {
      console.log(`[commands] skipped unlicensed guild ${guild.id}`);
      scheduleGuildValidation(context, guild);
      continue;
    }
    try {
      const registered = await guild.commands.set(commandPayload);
      console.log(`[commands] synced guild ${guild.id} (${guild.name}) with ${registered.size} commands`);
    } catch (error) {
      console.error(`[commands] failed to sync guild ${guild.id} (${guild.name})`, error);
    }
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
  await context.services.polls.processExpirations().catch(() => null);
  const pollExpirationTimer = setInterval(() => void context.services.polls.processExpirations().catch(() => null), 60 * 1000);
  pollExpirationTimer.unref?.();
  await context.services.events.processExpirations().catch(() => null);
  const eventExpirationTimer = setInterval(() => void context.services.events.processExpirations().catch(() => null), 60 * 1000);
  eventExpirationTimer.unref?.();

  let lastPartnerPromoDate = "";
  const processPartnerPromotions = async () => {
    const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const dateKey = kstNow.toISOString().slice(0, 10);
    const hour = kstNow.getUTCHours();
    const minute = kstNow.getUTCMinutes();
    if (hour !== 17 || minute > 5 || lastPartnerPromoDate === dateKey) return;
    lastPartnerPromoDate = dateKey;
    const result = await context.services.partners.processDailyMessages();
    console.log(`[partner] daily promotions processed at KST 17:00`, result);
  };
  await processPartnerPromotions().catch((error) => console.error("[partner] daily promotion failed:", error));
  const partnerPromoTimer = setInterval(() => void processPartnerPromotions().catch((error) => console.error("[partner] daily promotion failed:", error)), 30 * 1000);
  partnerPromoTimer.unref?.();
}
