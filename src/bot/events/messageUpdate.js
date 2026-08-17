import { isAllowedGuild } from "../../shared/guards.js";
import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleMessageUpdate(oldMessage, newMessage, context) {
  const guildId = newMessage?.guildId || oldMessage?.guildId;
  if (!guildId || !(await isAllowedGuild(context, guildId))) {
    return;
  }

  if (newMessage?.author?.bot || oldMessage?.author?.bot) {
    return;
  }
  const access = await canUseFeature(context, guildId, "logs");
  if (!access.featureAllowed) return;

  await context.services.messageLogs.handleMessageUpdate(oldMessage, newMessage).catch(() => null);
}
