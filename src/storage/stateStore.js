import { createDefaultState, createDefaultGuildState } from "../config/defaults.js";
import { connectMongo } from "../database/connect.js";
import { GuildStateModel } from "../database/models/guildState.js";
import { normalizeTicketSettings } from "../shared/ticket.js";

function clone(value) {
  return structuredClone(value);
}

function normalizeGuildState(doc) {
  if (!doc) {
    return null;
  }

  const defaults = createDefaultGuildState();
  const source = JSON.parse(JSON.stringify(doc));
  const { _id, __v, ...data } = source;

  const normalized = {
    ...defaults,
    ...data,
    settings: {
      ...defaults.settings,
      ...(data.settings || {})
    },
    notes: Array.isArray(data.notes) ? data.notes : [],
    punishments: Array.isArray(data.punishments) ? data.punishments : [],
    joinOrder: Array.isArray(data.joinOrder) ? data.joinOrder : [],
    tickets: {
      ...defaults.tickets,
      ...(data.tickets || {})
    },
    polls: {
      ...defaults.polls,
      ...(data.polls || {})
    },
    tempChannels: {
      ...defaults.tempChannels,
      ...(data.tempChannels || {})
    }
  };

  const logs = data.settings?.logs || {};
  normalized.settings.logs = {
    ...defaults.settings.logs,
    enabled: logs.enabled ?? defaults.settings.logs.enabled,
    moderationChannelId: logs.moderationChannelId || "",
    securityChannelId: logs.securityChannelId || "",
    serverChannelId: logs.serverChannelId || "",
    voteChannelId: logs.voteChannelId || "",
    systemChannelId: logs.systemChannelId || ""
  };

  const staff = data.settings?.staff || {};
  const staffStatuses = staff.statuses && typeof staff.statuses === "object" ? staff.statuses : {};
  normalized.settings.staff = {
    ...defaults.settings.staff,
    enabled: staff.enabled ?? defaults.settings.staff.enabled,
    ...staff,
    channelId: staff.channelId || "",
    messageId: staff.messageId || "",
    statuses: {
      ...staffStatuses
    }
  };

  const security = data.settings?.security || {};
  normalized.settings.security = {
    ...defaults.settings.security,
    ...security,
    enabled: security.enabled ?? defaults.settings.security.enabled,
    massMentionEnabled: security.massMentionEnabled ?? defaults.settings.security.massMentionEnabled,
    spamEnabled: security.spamEnabled ?? defaults.settings.security.spamEnabled,
    profanityEnabled: security.profanityEnabled ?? defaults.settings.security.profanityEnabled,
    inviteEnabled: security.inviteEnabled ?? defaults.settings.security.inviteEnabled
  };

  normalized.settings.ticket = normalizeTicketSettings(data.settings?.ticket || defaults.settings.ticket);

  return normalized;
}

function serializeGuildState(guildId, guildState) {
  const payload = clone(guildState);
  delete payload._id;
  delete payload.__v;
  payload.guildId = guildId;
  return payload;
}

export class StateStore {
  constructor({ mongoUri, mongoDbName, initialState = createDefaultState() }) {
    this.mongoUri = mongoUri;
    this.mongoDbName = mongoDbName;
    this.initialState = initialState;
    this.state = structuredClone(initialState);
    this.ready = null;
    this.queue = Promise.resolve();
  }

  async load() {
    if (this.ready) {
      return this.ready;
    }

    this.ready = (async () => {
      await connectMongo({ uri: this.mongoUri, dbName: this.mongoDbName });
      const docs = await GuildStateModel.find({}).lean();
      this.state = structuredClone(this.initialState);
      this.state.guilds = {};

      for (const doc of docs) {
        this.state.guilds[doc.guildId] = normalizeGuildState(doc);
      }

      return this.state;
    })();

    return this.ready;
  }

  async saveGuild(guildId) {
    const guildState = this.state.guilds?.[guildId];
    if (!guildState) {
      return null;
    }

    await GuildStateModel.replaceOne(
      { guildId },
      serializeGuildState(guildId, guildState),
      { upsert: true }
    );

    return guildState;
  }

  async resetGuild(guildId, createGuildState = createDefaultGuildState) {
    await this.load();

    const task = async () => {
      this.state.guilds ??= {};
      this.state.guilds[guildId] = createGuildState();
      await this.saveGuild(guildId);
      return this.state.guilds[guildId];
    };

    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  async ensureGuild(guildId, createGuildState = createDefaultGuildState) {
    await this.load();

    const task = async () => {
      this.state.guilds ??= {};

      if (!this.state.guilds[guildId]) {
        this.state.guilds[guildId] = createGuildState();
        await this.saveGuild(guildId);
      }

      return this.state.guilds[guildId];
    };

    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  async patchGuild(guildId, updater, createGuildState = createDefaultGuildState) {
    await this.load();

    const task = async () => {
      this.state.guilds ??= {};

      if (!this.state.guilds[guildId]) {
        this.state.guilds[guildId] = createGuildState();
      }

      const draft = clone(this.state.guilds[guildId]);
      const result = await updater(draft, this.state);
      this.state.guilds[guildId] = draft;
      await this.saveGuild(guildId);
      return result;
    };

    this.queue = this.queue.then(task, task);
    return this.queue;
  }

  snapshotGuild(guildId) {
    const guild = this.state.guilds?.[guildId];
    return guild ? clone(guild) : null;
  }

  getState() {
    return clone(this.state);
  }

  async listGuilds() {
    await this.load();
    return Object.values(this.state.guilds ?? {}).map(clone);
  }

  async close() {
    return null;
  }
}
