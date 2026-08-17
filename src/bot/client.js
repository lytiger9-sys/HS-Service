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

  client.once("ready", () => void handleReady(client, context).catch((error) => console.error("[bot] ready error:", error)));
  client.on("guildCreate", (guild) => void handleGuildCreate(guild, context).catch((error) => console.error("[bot] guildCreate error:", error)));
  client.on("guildMemberAdd", (member) => void handleGuildMemberAdd(member, context).catch((error) => console.error("[bot] guildMemberAdd error:", error)));
  client.on("messageCreate", (message) => void handleMessageCreate(message, context).catch((error) => console.error("[bot] messageCreate error:", error)));
  client.on("messageUpdate", (oldMessage, newMessage) => void handleMessageUpdate(oldMessage, newMessage, context).catch((error) => console.error("[bot] messageUpdate error:", error)));
  client.on("messageDelete", (message) => void handleMessageDelete(message, context).catch((error) => console.error("[bot] messageDelete error:", error)));
  client.on("messageDeleteBulk", (messages, channel) => void handleMessageDeleteBulk(messages, channel, context).catch((error) => console.error("[bot] messageDeleteBulk error:", error)));
  client.on("interactionCreate", (interaction) => void handleInteractionCreate(interaction, context).catch((error) => console.error("[bot] interactionCreate error:", error)));
  client.on("voiceStateUpdate", (oldState, newState) => void handleVoiceStateUpdate(oldState, newState, context).catch((error) => console.error("[bot] voiceStateUpdate error:", error)));

  client.on("guildDelete", async (guild) => {
    if (!(await isAllowedGuild(context, guild.id))) {
      return;
    }
    console.log(`[bot] left allowed guild ${guild.id}`);
  });

  await client.login(context.config.discordToken);
  return client;
}
