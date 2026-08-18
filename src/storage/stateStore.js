import { createDefaultState, createDefaultGuildState } from "../config/defaults.js";
import { connectMongo, mongoose } from "../database/connect.js";
import { GuildStateModel } from "../database/models/guildState.js";
import { normalizeTicketSettings } from "../shared/ticket.js";

function clone(value) {
  return structuredClone(value);
}

function storedBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => storedBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "on", "yes"].includes(value.trim().toLowerCase());
  return fallback;
}

function summarizeSettings(settings = {}) {
  return Object.fromEntries(Object.entries(settings).map(([section, value]) => [section, {
    enabled: value && typeof value === "object" ? value.enabled : undefined,
    keys: value && typeof value === "object" ? Object.keys(value) : []
  }]));
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
    },
    partners: Array.isArray(data.partners) ? data.partners : [],
    bannerSlots: Array.isArray(data.bannerSlots) ? data.bannerSlots : [],
    shop: {
      ...defaults.shop,
      ...(data.shop || {}),
      products: Array.isArray(data.shop?.products) ? data.shop.products : [],
      wallets: data.shop?.wallets && typeof data.shop.wallets === "object" ? data.shop.wallets : {},
      purchases: Array.isArray(data.shop?.purchases) ? data.shop.purchases : []
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
  normalized.settings.partner = {
    ...defaults.settings.partner,
    ...(data.settings?.partner || {}),
    banner: {
      ...defaults.settings.partner.banner,
      ...(data.settings?.partner?.banner || {})
    }
  };

  const booleanDefaults = [
    ["welcome", "enabled"], ["polls", "enabled"], ["embed", "enabled"], ["notice", "enabled"],
    ["honeypot", "enabled"], ["security", "enabled"], ["security", "massMentionEnabled"],
    ["security", "spamEnabled"], ["security", "profanityEnabled"], ["security", "inviteEnabled"],
    ["assignment", "enabled"], ["nickname", "enabled"], ["voice", "enabled"], ["staff", "enabled"],
    ["logs", "enabled"], ["partner", "enabled"]
  ];
  for (const [section, key] of booleanDefaults) {
    normalized.settings[section][key] = storedBoolean(normalized.settings[section][key], defaults.settings[section][key]);
  }
  normalized.settings.partner.banner.enabled = storedBoolean(
    normalized.settings.partner.banner.enabled,
    defaults.settings.partner.banner.enabled
  );
  normalized.settings.embed.scheduleEnabled = storedBoolean(
    normalized.settings.embed.scheduleEnabled,
    defaults.settings.embed.scheduleEnabled
  );
  normalized.shop.enabled = storedBoolean(normalized.shop.enabled, defaults.shop.enabled);
  normalized.shop.gamblingEnabled = storedBoolean(normalized.shop.gamblingEnabled, defaults.shop.gamblingEnabled);

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
      console.info("[storage] loaded guild states", {
        database: mongoose.connection.name,
        collection: GuildStateModel.collection.name,
        count: docs.length,
        settings: summarizeSettings(docs[0]?.settings)
      });
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

    const serialized = serializeGuildState(guildId, guildState);
    const result = await GuildStateModel.replaceOne(
      { guildId },
      serialized,
      { upsert: true }
    );
    const persisted = await GuildStateModel.findOne({ guildId }, { guildId: 1, settings: 1, shop: 1 }).lean();
    if (!persisted) {
      throw new Error(`GuildState persistence verification failed for ${guildId}`);
    }
    console.info("[storage] persisted guild state", {
      guildId,
      database: mongoose.connection.name,
      collection: GuildStateModel.collection.name,
      acknowledged: result.acknowledged,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      settings: summarizeSettings(persisted.settings)
    });

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
