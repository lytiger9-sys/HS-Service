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

async function send(channel, payload) {
  if (!channel) {
    return null;
  }

  return channel.send(payload).catch(() => null);
}

export function createLogService(context, guildState) {
  async function getSettings(guildId) {
    await guildState.ensure(guildId);
    return guildState.snapshot(guildId).settings;
  }

  async function sendConfigured(guildId, channelId, payload) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
      return null;
    }

    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) {
      return null;
    }

    const channel = await resolveTextChannel(guild, channelId);
    return send(channel, payload);
  }

  async function sendLogByKey(guildId, key, payload) {
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) {
      return null;
    }
    const channelId = settings.logs?.[key];
    return sendConfigured(guildId, channelId, payload);
  }

  async function editLogByKey(guildId, key, messageId, payload) {
    if (!messageId) return null;
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) return null;
    const channel = await resolveTextChannel(guild, settings.logs?.[key]);
    if (!channel) return null;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    return message?.edit(payload).catch(() => null) || null;
  }

  async function sendWelcomeError(guildId, payload) {
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) {
      return null;
    }
    return sendConfigured(guildId, settings.welcome.errorChannelId, payload);
  }

  async function sendHoneypotLog(guildId, payload) {
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) {
      return null;
    }
    return sendConfigured(guildId, settings.honeypot.logChannelId, payload);
  }

  return {
    sendConfigured,
    sendLogByKey,
    editLogByKey,
    sendWelcomeError,
    sendHoneypotLog
  };
}
