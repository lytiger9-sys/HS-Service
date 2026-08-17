import assert from "node:assert/strict";
import test from "node:test";
import { PLAN_DEFINITIONS, PLAN_IDS } from "../src/config/plans.js";
import { normalizePlan } from "../src/services/licenseService.js";

test("five plans are ordered from free to enterprise", () => {
  assert.deepEqual(PLAN_DEFINITIONS.map((plan) => plan.id), ["free", "basic", "standard", "pro", "enterprise"]);
  assert.equal(PLAN_IDS.size, 5);
});

test("unknown plans fall back to free and known plans are preserved", () => {
  assert.equal(normalizePlan("unknown"), "free");
  assert.equal(normalizePlan("standard"), "standard");
  assert.equal(normalizePlan("enterprise"), "enterprise");
});
