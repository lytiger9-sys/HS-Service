import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_DEFINITIONS, PLAN_IDS, getPlanDefinition } from "../src/config/plans.js";
import { normalizePlan } from "../src/services/licenseService.js";

test("three plans are ordered from free to pro", () => {
  assert.deepEqual(PLAN_DEFINITIONS.map((plan) => plan.id), ["free", "standard", "pro"]);
  assert.equal(PLAN_IDS.size, 3);
});

test("new licenses accept only current plans while legacy Enterprise licenses resolve to Pro", () => {
  assert.equal(normalizePlan("unknown"), "free");
  assert.equal(normalizePlan("basic"), "free");
  assert.equal(normalizePlan("standard"), "standard");
  assert.equal(normalizePlan("pro"), "pro");
  assert.equal(normalizePlan("enterprise"), "free");
  assert.equal(getPlanDefinition("enterprise").id, "pro");
});
