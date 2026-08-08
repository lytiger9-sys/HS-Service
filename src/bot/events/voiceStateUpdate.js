import { isAllowedGuild } from "../../shared/guards.js";

export default async function handleVoiceStateUpdate(oldState, newState, context) {
  if (!newState.guild || !isAllowedGuild(context, newState.guild.id)) {
    return;
  }

  await context.services.tempChannels.handleVoiceStateUpdate(oldState, newState);
}
