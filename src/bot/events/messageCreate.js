import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleMessageCreate(message, context) {
  if (!message.guild || message.author.bot) {
    return;
  }

  if (!isAllowedGuild(context, message.guild.id)) {
    if (await context.services.partners.handleMessage(message)) return;
    return;
  }

  if (await context.services.partners.handleMessage(message)) {
    return;
  }

  if (await context.services.honeypot.handleMessage(message)) {
    return;
  }

  if (await context.services.tickets.handleCloseShortcut(message)) {
    return;
  }

  await context.services.moderation.evaluateMessage(message).catch(() => null);
  await context.services.assignment.handleMessage(message).catch(() => null);
}
