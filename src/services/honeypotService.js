import { buildBaseEmbed, palette, parseColor } from "../shared/embeds.js";

async function resolveTextChannel(guild, channelId) {
  if (!channelId) {
    return null;
  }

  const cached = guild.channels.cache.get(channelId);
  if (cached?.isTextBased?.()) {
    return cached;
  }

  const fetched = await guild.channels.fetch(channelId).catch(() => null);
  return fetched?.isTextBased?.() ? fetched : null;
}

export function createHoneypotService(context, guildState) {
  async function buildStatusEmbed(guild, settings) {
    return buildBaseEmbed({
      title: "허니팟 감시 채널",
      description: [
        "이 채널에 메시지를 남긴 계정은 자동으로 추방됩니다.",
        "",
        `현재 적발 인원: **${settings.honeypot.caughtCount}명**`
      ].join("\n"),
      color: palette.danger,
      footer: guild.name,
      timestamp: Date.now()
    });
  }

  async function syncStatusMessage(guildId) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const settings = (await context.services.settings.getSettings(guildId));
    if (settings.honeypot?.enabled === false) {
      return null;
    }
    if (!settings.honeypot.channelId) {
      return null;
    }

    const channel = await resolveTextChannel(guild, settings.honeypot.channelId);
    if (!channel) {
      return null;
    }

    const embed = await buildStatusEmbed(guild, settings);
    const payload = { embeds: [embed] };

    let message = null;
    if (settings.honeypot.statusMessageId) {
      message = await channel.messages.fetch(settings.honeypot.statusMessageId).catch(() => null);
      if (message) {
        await message.edit(payload).catch(() => null);
        return message;
      }
    }

    message = await channel.send(payload).catch(() => null);
    if (message) {
      await message.pin().catch(() => null);
      await guildState.patch(guildId, (guildStateValue) => {
        guildStateValue.settings.honeypot.statusMessageId = message.id;
      });
    }

    return message;
  }

  async function handleMessage(message) {
    if (!message.guild || message.author.bot) {
      return false;
    }

    const settings = (await context.services.settings.getSettings(message.guild.id)).honeypot;
    if (settings.enabled === false) {
      return false;
    }
    if (!settings.channelId || message.channelId !== settings.channelId) {
      return false;
    }

    const member = message.member ?? await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) {
      return false;
    }

    const kicked = await member.kick("honeypot violation").then(() => true).catch(() => false);
    if (!kicked) {
      await context.services.logs.sendHoneypotLog(message.guild.id, {
        embeds: [
          buildBaseEmbed({
            title: "허니팟 추방 실패",
            description: `${member.user.tag} 을(를) 추방하지 못했습니다.`,
            color: palette.danger,
            timestamp: Date.now()
          })
        ]
      });
      return false;
    }

    const record = await context.services.punishments.addPunishment(message.guild.id, {
      type: "kick",
      memberId: member.id,
      memberTag: member.user.tag,
      moderatorId: context.client.user.id,
      moderatorTag: context.client.user.tag,
      reason: "honeypot channel message",
      durationMinutes: 0,
      source: "honeypot",
      channelId: message.channelId
    });

    await guildState.patch(message.guild.id, (guild) => {
      guild.settings.honeypot.caughtCount += 1;
      return guild.settings.honeypot;
    });

    await context.services.logs.sendHoneypotLog(message.guild.id, {
      embeds: [
        buildBaseEmbed({
          title: "허니팟 적발",
          description: `${member.user.tag} 을(를) 추방했습니다.`,
          color: parseColor("#8d2d2d"),
          fields: [
            { name: "채널", value: `<#${message.channelId}>`, inline: true },
            { name: "적발 수", value: String((await context.services.settings.getSettings(message.guild.id)).honeypot.caughtCount), inline: true }
          ],
          timestamp: Date.now()
        })
      ]
    });

    await syncStatusMessage(message.guild.id);
    return true;
  }

  return {
    syncStatusMessage,
    handleMessage
  };
}
