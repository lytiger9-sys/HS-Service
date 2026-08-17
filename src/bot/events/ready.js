import { commandList } from "../commands/index.js";
import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleReady(client, context) {
  console.log(`[bot] logged in as ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    if (!isAllowedGuild(context, guild.id)) {
      const license = await context.services.licenses.getActiveByGuild(guild.id).catch(() => null);
      if (!license) {
        await guild.leave().catch(() => null);
        continue;
      }
      await context.services.partners.cleanupExpiredBanners(guild.id).catch(() => null);
    }
  }

  const targetGuild = await client.guilds.fetch(context.config.allowedGuildId).catch(() => null);
  if (targetGuild) {
    await targetGuild.commands.set(commandList.map((command) => command.data.toJSON()));
    await context.services.honeypot.syncStatusMessage(targetGuild.id).catch(() => null);
  }
}
