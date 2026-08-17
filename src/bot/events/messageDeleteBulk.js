import { isAllowedGuild } from "../../shared/guards.js";
import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleMessageDeleteBulk(messages, channel, context) {
  const first = messages?.first?.();
  const guildId = channel?.guild?.id || first?.guildId || first?.guild?.id;
  if (!guildId || !(await isAllowedGuild(context, guildId))) {
    return;
  }
  const access = await canUseFeature(context, guildId, "logs");
  if (!access.featureAllowed) return;

  await context.services.messageLogs.handleMessageDeleteBulk(messages, channel).catch(() => null);
}
