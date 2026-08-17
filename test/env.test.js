import assert from "node:assert/strict";
import test from "node:test";

for (const [key, value] of Object.entries({
  DISCORD_TOKEN: "test-token",
  ALLOWED_GUILD_ID: "123",
  MONGODB_URI: "mongodb://localhost/test",
  DISCORD_CLIENT_ID: "client",
  DISCORD_CLIENT_SECRET: "secret",
  DISCORD_CALLBACK_URL: "http://localhost/callback",
  SESSION_SECRET: "session-secret"
})) {
  process.env[key] ??= value;
}

test("Render PORT and host defaults are supported", async () => {
  process.env.WEB_HOST = "0.0.0.0";
  process.env.PORT = "19000";
  const { loadConfig } = await import(`../src/config/env.js?test=${Date.now()}`);
  const config = loadConfig();
  assert.equal(config.webHost, "0.0.0.0");
  assert.equal(config.webPort, 19000);
});
