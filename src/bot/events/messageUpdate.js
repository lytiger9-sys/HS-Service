import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleMessageUpdate(oldMessage, newMessage, context) {
  const guildId = newMessage?.guildId || oldMessage?.guildId;
  if (!guildId || !isAllowedGuild(context, guildId)) {
    return;
  }

  if (newMessage?.author?.bot || oldMessage?.author?.bot) {
    return;
  }

  await context.services.messageLogs.handleMessageUpdate(oldMessage, newMessage).catch(() => null);
}
