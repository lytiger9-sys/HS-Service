import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleMessageDeleteBulk(messages, channel, context) {
  const first = messages?.first?.();
  const guildId = channel?.guild?.id || first?.guildId || first?.guild?.id;
  if (!guildId || !isAllowedGuild(context, guildId)) {
    return;
  }

  await context.services.messageLogs.handleMessageDeleteBulk(messages, channel).catch(() => null);
}
