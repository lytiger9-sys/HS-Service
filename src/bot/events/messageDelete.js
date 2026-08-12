import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleMessageDelete(message, context) {
  const guildId = message?.guildId || message?.guild?.id;
  if (!guildId || !isAllowedGuild(context, guildId)) {
    return;
  }

  if (message?.author?.bot) {
    return;
  }

  await context.services.messageLogs.handleMessageDelete(message).catch(() => null);
}
