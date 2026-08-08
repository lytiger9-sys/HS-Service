import { ChannelType, PermissionFlagsBits } from "discord.js";
import { buildBaseEmbed, palette } from "../shared/embeds.js";
import { slugifyDiscordName } from "../shared/naming.js";

async function resolveVoiceChannel(guild, channelId) {
  const cached = guild.channels.cache.get(channelId);
  if (cached?.type === ChannelType.GuildVoice) {
    return cached;
  }

  const fetched = await guild.channels.fetch(channelId).catch(() => null);
  return fetched?.type === ChannelType.GuildVoice ? fetched : null;
}

export function createTempChannelService(context, guildState) {
  async function createTemporaryVoiceChannel({ guild, member, name }) {
    const settings = (await context.services.settings.getSettings(guild.id)).voice;
    const channelName = slugifyDiscordName(name || settings.defaultName || "임시 채널", "임시-채널");

    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: settings.categoryId || null,
      userLimit: Number(settings.maxUsers || 0) || undefined,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel]
        }
      ]
    });

    await guildState.patch(guild.id, (guildStateValue) => {
      guildStateValue.tempChannels[channel.id] = {
        channelId: channel.id,
        creatorId: member.id,
        creatorTag: member.user.tag,
        createdAt: new Date().toISOString()
      };
      return guildStateValue.tempChannels[channel.id];
    });

    if (member.voice?.channelId) {
      await member.voice.setChannel(channel).catch(() => null);
    }

    await context.services.logs.sendLogByKey(guild.id, "systemChannelId", {
      embeds: [
        buildBaseEmbed({
          title: "임시 음성 채널 생성",
          description: `${member.user.tag} 이(가) ${channel.name} 채널을 만들었습니다.`,
          color: palette.success,
          timestamp: Date.now()
        })
      ]
    });

    return channel;
  }

  async function cleanupEmptyChannel(guildId, channelId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return false;
    }

    const channel = await resolveVoiceChannel(guild, channelId);
    if (!channel) {
      await guildState.patch(guildId, (guildStateValue) => {
        delete guildStateValue.tempChannels[channelId];
      });
      return false;
    }

    if (channel.members.size > 0) {
      return false;
    }

    await channel.delete("temporary voice channel cleaned").catch(() => null);
    await guildState.patch(guildId, (guildStateValue) => {
      delete guildStateValue.tempChannels[channelId];
    });
    return true;
  }

  async function handleVoiceStateUpdate(oldState, newState) {
    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;
    const guildId = newState.guild.id;

    if (oldChannelId && oldChannelId !== newChannelId) {
      const guildData = guildState.snapshot(guildId);
      if (guildData?.tempChannels?.[oldChannelId]) {
        await cleanupEmptyChannel(guildId, oldChannelId);
      }
    }
  }

  async function listTempChannels(guildId) {
    await guildState.ensure(guildId);
    return Object.values(guildState.snapshot(guildId).tempChannels ?? {});
  }

  return {
    createTemporaryVoiceChannel,
    cleanupEmptyChannel,
    handleVoiceStateUpdate,
    listTempChannels
  };
}
