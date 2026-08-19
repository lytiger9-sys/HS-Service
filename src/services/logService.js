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
    if (!guild) return null;
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) return null;
    const channel = await resolveTextChannel(guild, channelId);
    return send(channel, payload);
  }

  async function sendLogByKey(guildId, key, payload) {
    const settings = await getSettings(guildId);
    if (key === "voteChannelId") {
      return sendConfigured(guildId, settings.polls?.voteLogChannelId, payload);
    }
    if (key === "securityChannelId") {
      return sendConfigured(guildId, settings.security?.securityLogChannelId, payload);
    }
    const eventKey = key === "messageChange" ? "messageChangeEnabled"
      : key === "categoryChange" ? "categoryChangeEnabled"
      : key === "channelChange" ? "channelChangeEnabled"
      : ["guildBrandingChange", "serverNameChange", "serverIdentityChange"].includes(key) ? "serverIdentityChangeEnabled"
      : key === "roleChange" ? "roleChangeEnabled"
      : key === "moderationAction" ? "moderationActionEnabled" : null;
    if (eventKey && settings.logs?.[eventKey] === false) return null;
    return sendConfigured(guildId, settings.logs?.serverChannelId, payload);
  }

  async function editLogByKey(guildId, key, messageId, payload) {
    if (!messageId) return null;
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) return null;
    const channelId = key === "voteChannelId" ? settings.polls?.voteLogChannelId
      : key === "securityChannelId" ? settings.security?.securityLogChannelId
      : settings.logs?.serverChannelId;
    const channel = await resolveTextChannel(guild, channelId);
    if (!channel) return null;
    const message = await channel.messages.fetch(messageId).catch(() => null);
    return message?.edit(payload).catch(() => null) || null;
  }

  async function sendServerNotice(guildId, payload) {
    const guild = await context.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return null;
    const settings = await getSettings(guildId);
    const channel = await resolveTextChannel(guild, settings.logs?.serverChannelId);
    return send(channel, payload);
  }

  async function sendWelcomeError(guildId, payload) {
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) return null;
    return sendConfigured(guildId, settings.logs?.serverChannelId, payload);
  }

  async function sendHoneypotLog(guildId, payload) {
    const settings = await getSettings(guildId);
    if (settings.logs?.enabled === false) return null;
    return sendConfigured(guildId, settings.security?.securityLogChannelId, payload);
  }

  return {
    sendConfigured,
    sendServerNotice,
    sendLogByKey,
    editLogByKey,
    sendWelcomeError,
    sendHoneypotLog
  };
}
