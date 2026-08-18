import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleMessageCreate(message, context) {
  if (!message.guild || message.author.bot) {
    return;
  }

  const shopAccess = await canUseFeature(context, message.guild.id, "shop");
  if (shopAccess.featureAllowed) await context.services.shop.recordMessage(message).catch(() => null);

  const partnerAccess = await canUseFeature(context, message.guild.id, "partner");
  if (!partnerAccess.allowed) return;

  if (partnerAccess.featureAllowed && await context.services.partners.handleMessage(message)) {
    return;
  }

  const honeypotAccess = await canUseFeature(context, message.guild.id, "honeypot");
  if (honeypotAccess.featureAllowed && await context.services.honeypot.handleMessage(message)) {
    return;
  }

  const ticketAccess = await canUseFeature(context, message.guild.id, "ticket");
  if (ticketAccess.featureAllowed && await context.services.tickets.handleCloseShortcut(message)) {
    return;
  }

  const securityAccess = await canUseFeature(context, message.guild.id, "security");
  if (securityAccess.featureAllowed) {
    await context.services.moderation.evaluateMessage(message).catch(() => null);
  }
  const assignmentAccess = await canUseFeature(context, message.guild.id, "assignment");
  if (assignmentAccess.featureAllowed) {
    await context.services.assignment.handleMessage(message).catch(() => null);
  }
}
