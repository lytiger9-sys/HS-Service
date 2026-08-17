import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleGuildMemberRemove(member, context) {
  if (!(await isAllowedGuild(context, member.guild.id))) {
    return;
  }
  await context.services.overviewChannels.syncGuild(member.guild).catch((error) => {
    console.error(`[overview] member removal sync failed for ${member.guild.id}:`, error);
  });
}
