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
    const action = settings.honeypot.action === "ban" ? "차단" : "추방";
    return buildBaseEmbed({
      title: "허니팟 감시 채널",
      description: [
        `이 채널에 메시지를 남긴 계정은 자동으로 ${action}됩니다.`,
        "메시지를 보내면 최근 메시지가 삭제되고 제재됩니다.",
        "",
        `현재 ${action}된 사용자 수: **${settings.honeypot.caughtCount}명**`
      ].join("\n"),
      color: palette.danger,
      footer: guild.name,
      timestamp: Date.now()
    });
  }

  async function configureChannel(guildId, channelId, action) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new Error("서버를 찾을 수 없습니다.");
    const channel = await resolveTextChannel(guild, channelId);
    if (!channel) throw new Error("텍스트 채널만 허니팟 채널로 지정할 수 있습니다.");
    if (!["ban", "kick"].includes(action)) throw new Error("허용되지 않는 허니팟 제재 방식입니다.");
    await guildState.patch(guildId, (guildStateValue) => {
      guildStateValue.settings.honeypot.enabled = true;
      guildStateValue.settings.honeypot.channelId = channel.id;
      guildStateValue.settings.honeypot.action = action;
      guildStateValue.settings.honeypot.statusMessageId = "";
      return guildStateValue.settings.honeypot;
    });
    return syncStatusMessage(guildId);
  }

  async function deleteRecentMessages(channel, limit = 100) {
    const messages = await channel.messages.fetch({ limit }).catch(() => null);
    if (!messages?.size) return 0;
    const deletable = messages.filter((entry) => Date.now() - entry.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
    const deleted = await channel.bulkDelete(deletable, true).catch(() => null);
    return deleted?.size || 0;
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

    await deleteRecentMessages(message.channel);
    const action = settings.action === "ban" ? "ban" : "kick";
    const punished = action === "ban"
      ? await member.ban({ reason: "honeypot violation" }).then(() => true).catch(() => false)
      : await member.kick("honeypot violation").then(() => true).catch(() => false);
    if (!punished) {
      await context.services.logs.sendHoneypotLog(message.guild.id, {
        embeds: [
          buildBaseEmbed({
            title: `허니팟 ${action === "ban" ? "차단" : "추방"} 실패`,
            description: `${member.user.tag} 을(를) ${action === "ban" ? "차단" : "추방"}하지 못했습니다.`,
            color: palette.danger,
            timestamp: Date.now()
          })
        ]
      });
      return false;
    }

    const record = await context.services.punishments.addPunishment(message.guild.id, {
      type: action,
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
          description: `${member.user.tag} 을(를) ${action === "ban" ? "차단" : "추방"}했습니다.`,
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
    configureChannel,
    syncStatusMessage,
    handleMessage
  };
}
