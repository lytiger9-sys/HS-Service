import test from "node:test";
import assert from "node:assert/strict";
import { interactionFeature, planHasFeature } from "../src/shared/planAccess.js";

test("plan feature gates match the five plan definitions", () => {
  assert.equal(planHasFeature("free", "partner"), false);
  assert.equal(planHasFeature("basic", "welcome"), true);
  assert.equal(planHasFeature("standard", "ticket"), true);
  assert.equal(planHasFeature("standard", "partner"), false);
  assert.equal(planHasFeature("pro", "partner"), true);
  assert.equal(planHasFeature("enterprise", "shop"), true);
});

test("Discord interaction scopes map to server-side features", () => {
  assert.equal(interactionFeature("partner:apply"), "partner");
  assert.equal(interactionFeature("ticket:open"), "ticket");
  assert.equal(interactionFeature("poll:vote:abc:0"), "polls");
  assert.equal(interactionFeature("unknown:action"), null);
});
