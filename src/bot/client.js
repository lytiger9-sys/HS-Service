import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials
} from "discord.js";
import { commandMap } from "./commands/index.js";
import handleReady from "./events/ready.js";
import handleGuildCreate from "./events/guildCreate.js";
import handleGuildMemberAdd from "./events/guildMemberAdd.js";
import handleGuildMemberRemove from "./events/guildMemberRemove.js";
import handleGuildMemberUpdate from "./events/guildMemberUpdate.js";
import handleChannelDelete from "./events/channelDelete.js";
import handleMessageCreate from "./events/messageCreate.js";
import handleMessageUpdate from "./events/messageUpdate.js";
import handleMessageDelete from "./events/messageDelete.js";
import handleMessageDeleteBulk from "./events/messageDeleteBulk.js";
import handleInteractionCreate from "./events/interactionCreate.js";
import handleVoiceStateUpdate from "./events/voiceStateUpdate.js";
import { isAllowedGuild } from "../shared/guards.js";

export async function createBot(context) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message]
  });

  client.commands = new Collection(commandMap);
  context.commands = commandMap;
  context.client = client;

  const runAllowedGuildEvent = async (guildId, handler) => {
    if (!(await isAllowedGuild(context, guildId))) return;
    await handler();
  };

  client.once("ready", () => void handleReady(client, context).catch((error) => console.error("[bot] ready error:", error)));
  client.on("guildCreate", (guild) => void handleGuildCreate(guild, context).catch((error) => console.error("[bot] guildCreate error:", error)));
  client.on("guildMemberAdd", (member) => void runAllowedGuildEvent(member.guild?.id, () => handleGuildMemberAdd(member, context)).catch((error) => console.error("[bot] guildMemberAdd error:", error)));
  client.on("inviteCreate", (invite) => context.services.invites.remember(invite));
  client.on("inviteDelete", (invite) => context.services.invites.forget(invite));
  client.on("guildMemberRemove", (member) => void runAllowedGuildEvent(member.guild?.id, () => Promise.all([
    handleGuildMemberRemove(member, context),
    context.services.serverAuditLogs.handleMemberRemove(member)
  ])).catch((error) => console.error("[bot] guildMemberRemove error:", error)));
  client.on("guildBanAdd", (ban) => void runAllowedGuildEvent(ban.guild?.id, () => context.services.serverAuditLogs.handleBanAdd(ban)).catch((error) => console.error("[audit] guildBanAdd error:", error)));
  client.on("guildMemberUpdate", (oldMember, newMember) => void runAllowedGuildEvent(newMember.guild?.id || oldMember.guild?.id, () => handleGuildMemberUpdate(oldMember, newMember, context)).catch((error) => console.error("[bot] guildMemberUpdate error:", error)));
  client.on("channelDelete", (channel) => void runAllowedGuildEvent(channel.guild?.id || channel.guildId, () => Promise.all([
    handleChannelDelete(channel, context),
    context.services.serverAuditLogs.handleChannelDelete(channel)
  ])).catch((error) => console.error("[bot] channelDelete error:", error)));
  client.on("guildUpdate", (oldGuild, newGuild) => void runAllowedGuildEvent(newGuild.id, () => context.services.serverAuditLogs.handleGuildUpdate(oldGuild, newGuild)).catch((error) => console.error("[audit] guildUpdate error:", error)));
  client.on("channelCreate", (channel) => void runAllowedGuildEvent(channel.guild?.id, () => context.services.serverAuditLogs.handleChannelCreate(channel)).catch((error) => console.error("[audit] channelCreate error:", error)));
  client.on("channelUpdate", (oldChannel, newChannel) => void runAllowedGuildEvent(newChannel.guild?.id || oldChannel.guild?.id, () => context.services.serverAuditLogs.handleChannelUpdate(oldChannel, newChannel)).catch((error) => console.error("[audit] channelUpdate error:", error)));
  client.on("messageCreate", (message) => {
    if (!message.guild) {
      return void context.services.purchaseFeedback.handleDirectMessage(message).catch((error) => console.error("[bot] purchase feedback DM error:", error));
    }
    return void runAllowedGuildEvent(message.guild.id, () => handleMessageCreate(message, context)).catch((error) => console.error("[bot] messageCreate error:", error));
  });
  client.on("messageUpdate", (oldMessage, newMessage) => void runAllowedGuildEvent(newMessage.guild?.id || oldMessage.guild?.id, () => handleMessageUpdate(oldMessage, newMessage, context)).catch((error) => console.error("[bot] messageUpdate error:", error)));
  client.on("messageDelete", (message) => void runAllowedGuildEvent(message.guild?.id, () => handleMessageDelete(message, context)).catch((error) => console.error("[bot] messageDelete error:", error)));
  client.on("messageDeleteBulk", (messages, channel) => void runAllowedGuildEvent(channel.guild?.id, () => handleMessageDeleteBulk(messages, channel, context)).catch((error) => console.error("[bot] messageDeleteBulk error:", error)));
  client.on("interactionCreate", (interaction) => void handleInteractionCreate(interaction, context).catch((error) => console.error("[bot] interactionCreate error:", error)));
  client.on("voiceStateUpdate", (oldState, newState) => void runAllowedGuildEvent(newState.guild?.id || oldState.guild?.id, () => handleVoiceStateUpdate(oldState, newState, context)).catch((error) => console.error("[bot] voiceStateUpdate error:", error)));

  client.on("guildDelete", async (guild) => {
    if (!(await isAllowedGuild(context, guild.id))) {
      return;
    }
    console.log(`[bot] left allowed guild ${guild.id}`);
  });

  await client.login(context.config.discordToken);

  return client;
}
