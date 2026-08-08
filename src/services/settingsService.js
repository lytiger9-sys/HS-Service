function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function mergeDeep(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      target[key] = value.map((entry) => (isPlainObject(entry) ? mergeDeep({}, entry) : entry));
      continue;
    }

    if (isPlainObject(value)) {
      target[key] ??= {};
      mergeDeep(target[key], value);
      continue;
    }

    target[key] = value;
  }

  return target;
}

export function createSettingsService(context, guildState) {
  async function getSettings(guildId) {
    await guildState.ensure(guildId);
    return guildState.snapshot(guildId).settings;
  }

  async function updateSettings(guildId, patch) {
    return guildState.patch(guildId, (guild) => {
      mergeDeep(guild.settings, patch);
      return guild.settings;
    });
  }

  async function updateSection(guildId, section, patch) {
    return guildState.patch(guildId, (guild) => {
      guild.settings[section] ??= {};
      if (isPlainObject(patch)) {
        mergeDeep(guild.settings[section], patch);
      } else {
        guild.settings[section] = patch;
      }
      return guild.settings[section];
    });
  }

  async function setSectionValue(guildId, section, key, value) {
    return guildState.patch(guildId, (guild) => {
      guild.settings[section] ??= {};
      guild.settings[section][key] = value;
      return guild.settings[section];
    });
  }

  return {
    getSettings,
    updateSettings,
    updateSection,
    setSectionValue
  };
}
