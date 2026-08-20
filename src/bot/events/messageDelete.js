import { isAllowedGuild } from "../../shared/guards.js";
import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleMessageDelete(message, context) {
  const guildId = message?.guildId || message?.guild?.id;
  if (!guildId || !(await isAllowedGuild(context, guildId))) {
    return;
  }

  const access = await canUseFeature(context, guildId, "logs");
  if (!access.featureAllowed) return;

  await context.services.messageLogs.handleMessageDelete(message).catch(() => null);
}
