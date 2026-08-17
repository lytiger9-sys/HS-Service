import { isAllowedGuild } from "../../shared/guards.js";
import { canUseFeature } from "../../shared/planAccess.js";

export default async function handleVoiceStateUpdate(oldState, newState, context) {
  if (!newState.guild || !(await isAllowedGuild(context, newState.guild.id))) {
    return;
  }
  const access = await canUseFeature(context, newState.guild.id, "voice");
  if (!access.featureAllowed) return;

  await context.services.tempChannels.handleVoiceStateUpdate(oldState, newState);
}
