import test from "node:test";
import assert from "node:assert/strict";
import { interactionFeature, planHasFeature } from "../src/shared/planAccess.js";
import { isAllowedGuild } from "../src/shared/guards.js";

test("plan feature gates match the five plan definitions", () => {
  assert.equal(planHasFeature("free", "partner"), false);
  assert.equal(planHasFeature("basic", "welcome"), true);
  assert.equal(planHasFeature("standard", "ticket"), true);
  assert.equal(planHasFeature("standard", "partner"), false);
  assert.equal(planHasFeature("pro", "partner"), true);
  assert.equal(planHasFeature("enterprise", "shop"), true);
  for (const plan of ["free", "basic", "standard", "pro", "enterprise"]) {
    assert.equal(planHasFeature(plan, "assignment"), false);
    assert.equal(planHasFeature(plan, "voice"), false);
    assert.equal(planHasFeature(plan, "honeypot"), false);
    assert.equal(planHasFeature(plan, "logs"), false);
  }
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

test("Discord interaction scopes map to server-side features", () => {
  assert.equal(interactionFeature("partner:apply"), "partner");
  assert.equal(interactionFeature("ticket:open"), "ticket");
  assert.equal(interactionFeature("poll:vote:abc:0"), "polls");
  assert.equal(interactionFeature("unknown:action"), null);
});
