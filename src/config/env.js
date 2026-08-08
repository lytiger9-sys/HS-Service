import dotenv from "dotenv";

dotenv.config();

function readRequired(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required in the environment`);
  }
  return value;
}

function readNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a valid number`);
  }

  return value;
}

function readBoolean(name, fallback = false) {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export function loadConfig() {
  return {
    botName: process.env.BOT_NAME?.trim() || "HS 종합봇",
    discordToken: readRequired("DISCORD_TOKEN"),
    allowedGuildId: readRequired("ALLOWED_GUILD_ID"),
    mongoUri: readRequired("MONGODB_URI"),
    mongoDbName: process.env.MONGODB_DB_NAME?.trim() || "hs_service",
    discordClientId: readRequired("DISCORD_CLIENT_ID"),
    discordClientSecret: readRequired("DISCORD_CLIENT_SECRET"),
    discordCallbackUrl: readRequired("DISCORD_CALLBACK_URL"),
    sessionSecret: readRequired("SESSION_SECRET"),
    sessionCookieSecure: readBoolean("SESSION_COOKIE_SECURE", false),
    webHost: process.env.WEB_HOST?.trim() || "127.0.0.1",
    webPort: readNumber("WEB_PORT", 3000)
  };
}
