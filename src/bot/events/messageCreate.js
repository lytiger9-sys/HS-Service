import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleMessageCreate(message, context) {
  if (!message.guild || message.author.bot) {
    return;
  }

  if (!isAllowedGuild(context, message.guild.id)) {
    return;
  }

  if (await context.services.honeypot.handleMessage(message)) {
    return;
  }

  await context.services.moderation.evaluateMessage(message).catch(() => null);
  await context.services.assignment.handleMessage(message).catch(() => null);
}
