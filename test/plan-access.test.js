import test from "node:test";
import assert from "node:assert/strict";
import { canUseFeature, interactionFeature, planHasFeature } from "../src/shared/planAccess.js";
import { isAllowedGuild } from "../src/shared/guards.js";

test("plan feature gates match the five plan definitions", () => {
  assert.equal(planHasFeature("free", "partner"), false);
  assert.equal(planHasFeature("basic", "welcome"), true);
  assert.equal(planHasFeature("standard", "ticket"), true);
  assert.equal(planHasFeature("standard", "partner"), false);
  assert.equal(planHasFeature("pro", "partner"), true);
  assert.equal(planHasFeature("enterprise", "shop"), true);
  for (const plan of ["free", "basic", "standard", "pro", "enterprise"]) {
    assert.equal(planHasFeature(plan, "assignment"), true);
    assert.equal(planHasFeature(plan, "voice"), true);
    assert.equal(planHasFeature(plan, "honeypot"), true);
  }
  assert.equal(planHasFeature("free", "logs"), false);
  assert.equal(planHasFeature("basic", "logs"), true);
  assert.equal(planHasFeature("standard", "embed"), true);
  assert.equal(planHasFeature("pro", "partner"), true);
  assert.equal(planHasFeature("enterprise", "shop"), true);
});

test("licensed guilds are allowed while unlicensed guilds are rejected", async () => {
  const context = {
    config: { allowedGuildId: "management" },
    services: { licenses: { getActiveByGuild: async (guildId) => guildId === "licensed" ? { plan: "basic" } : null } }
  };
  assert.equal(await isAllowedGuild(context, "management"), true);
  assert.equal(await isAllowedGuild(context, "licensed"), true);
  assert.equal(await isAllowedGuild(context, "unknown"), false);
});

test("management guild bypasses global feature bans", async () => {
  const context = {
    config: { allowedGuildId: "management" },
    services: {
      licenses: { getActiveByGuild: async () => null },
      adminControl: { get: async () => ({ featureBans: { shop: true } }) }
    }
  };
  const access = await canUseFeature(context, "management", "shop");
  assert.equal(access.bypass, true);
  assert.equal(access.featureAllowed, true);
});

test("Discord interaction scopes map to server-side features", () => {
  assert.equal(interactionFeature("partner:apply"), "partner");
  assert.equal(interactionFeature("ticket:open"), "ticket");
  assert.equal(interactionFeature("poll:vote:abc:0"), "polls");
  assert.equal(interactionFeature("staff:toggle"), "administrators");
  assert.equal(interactionFeature("unknown:action"), null);
});
