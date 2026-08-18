import { canUseFeature } from "../../shared/planAccess.js";
import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleGuildMemberUpdate(oldMember, newMember, context) {
  if (!newMember.guild || !(await isAllowedGuild(context, newMember.guild.id))) return;
  await context.services.boost.handleMemberUpdate(oldMember, newMember).catch(() => false);
  await context.services.serverAuditLogs.handleMemberUpdate(oldMember, newMember).catch(() => false);
  if (newMember.user?.bot) return;
  const addedRole = newMember.roles.cache.some((role) => !oldMember.roles.cache.has(role.id));
  if (!addedRole) return;
  const access = await canUseFeature(context, newMember.guild.id, "nickname");
  if (!access.featureAllowed) return;
  const settings = await context.services.settings.getSettings(newMember.guild.id);
  if (settings.nickname?.enabled === false) return;
  await context.services.nicknames.applyNickname(newMember, settings, "nickname role acquired").catch(() => false);
}
