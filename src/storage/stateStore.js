import { createDefaultState, createDefaultGuildState } from "../config/defaults.js";
import { connectMongo, mongoose } from "../database/connect.js";
import { GuildStateModel } from "../database/models/guildState.js";
import { normalizeTicketSettings } from "../shared/ticket.js";

function clone(value) {
  return structuredClone(value);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDefaults(defaults, source) {
  if (!isPlainObject(defaults) || !isPlainObject(source)) return source === undefined ? clone(defaults) : clone(source);
  const result = clone(defaults);
  for (const [key, value] of Object.entries(source)) {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? mergeDefaults(result[key], value)
      : clone(value);
  }
  return result;
}

function storedBoolean(value, fallback = false) {
  if (Array.isArray(value)) return value.some((entry) => storedBoolean(entry, false));
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "on", "yes"].includes(value.trim().toLowerCase());
  return fallback;
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
    settings: mergeDefaults(defaults.settings, data.settings || {}),
    notes: Array.isArray(data.notes) ? data.notes : [],
    punishments: Array.isArray(data.punishments) ? data.punishments : [],
    joinOrder: Array.isArray(data.joinOrder) ? data.joinOrder : [],
    tickets: mergeDefaults(defaults.tickets, data.tickets || {}),
    polls: {
      ...defaults.polls,
      ...(data.polls || {})
    },
    events: data.events && typeof data.events === "object" && !Array.isArray(data.events) ? data.events : {},
    tempChannels: {
      ...defaults.tempChannels,
      ...(data.tempChannels || {})
    },
    partners: Array.isArray(data.partners) ? data.partners : [],
    bannerSlots: Array.isArray(data.bannerSlots) ? data.bannerSlots : [],
    account: {
      ...defaults.account,
      ...(data.account || {}),
      bank: String(data.account?.bank || ""),
      number: String(data.account?.number || ""),
      holder: String(data.account?.holder || "")
    },
    expressions: {
      ...defaults.expressions,
      ...(data.expressions || {}),
      emojis: Array.isArray(data.expressions?.emojis) ? data.expressions.emojis : [],
      sounds: Array.isArray(data.expressions?.sounds) ? data.expressions.sounds : []
    },
    shop: {
      ...mergeDefaults(defaults.shop, data.shop || {}),
      birthdayChannelId: data.shop?.birthdayChannelId || "",
      birthdayReward: Number.isFinite(Number(data.shop?.birthdayReward)) ? Math.max(0, Number(data.shop.birthdayReward)) : defaults.shop.birthdayReward,
      birthdays: data.shop?.birthdays && typeof data.shop.birthdays === "object" ? data.shop.birthdays : {},
      birthdayClaims: data.shop?.birthdayClaims && typeof data.shop.birthdayClaims === "object" ? data.shop.birthdayClaims : {},
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
    inviteEnabled: security.inviteEnabled ?? defaults.settings.security.inviteEnabled,
    inviteTimeoutMinutes: security.inviteTimeoutMinutes ?? (Number(security.inviteTimeoutSeconds ?? defaults.settings.security.inviteTimeoutMinutes * 60) / 60)
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
    ["welcome", "enabled"], ["polls", "enabled"], ["embed", "enabled"], ["notice", "enabled"], ["events", "enabled"],
    ["honeypot", "enabled"], ["security", "enabled"], ["security", "massMentionEnabled"],
    ["security", "spamEnabled"], ["security", "profanityEnabled"], ["security", "inviteEnabled"],
    ["assignment", "enabled"], ["nickname", "enabled"], ["voice", "enabled"], ["staff", "enabled"],
    ["logs", "enabled"], ["partner", "enabled"]
  ];
  for (const [section, key] of booleanDefaults) {
    normalized.settings[section][key] = storedBoolean(normalized.settings[section][key], defaults.settings[section][key]);
  }
  const storedLogs = data.settings?.logs || {};
  normalized.settings.logs.serverIdentityChangeEnabled = storedBoolean(
    storedLogs.serverIdentityChangeEnabled ?? (storedLogs.serverNameChangeEnabled !== false && storedLogs.guildBrandingChangeEnabled !== false),
    defaults.settings.logs.serverIdentityChangeEnabled
  );
  normalized.settings.logs.roleChangeEnabled = storedBoolean(
    storedLogs.roleChangeEnabled,
    defaults.settings.logs.roleChangeEnabled
  );
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
