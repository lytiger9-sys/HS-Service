import { isAllowedGuild, scheduleGuildValidation } from "../../shared/guards.js";

export default async function handleGuildCreate(guild, context) {
  // 전역 명령어는 Discord 애플리케이션에 한 번 등록되면 새 서버에도 자동 제공됩니다.
  console.log(`[commands] global slash commands are available to new guild ${guild.id} (${guild.name})`);

  if (!(await isAllowedGuild(context, guild.id))) {
    scheduleGuildValidation(context, guild);
    return;
  }

  await context.services.honeypot.syncStatusMessage(guild.id).catch(() => null);
  await context.services.overviewChannels.syncGuild(guild).catch((error) => console.error(`[overview] sync failed for ${guild.id}:`, error));
}
