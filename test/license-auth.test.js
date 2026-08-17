import assert from "node:assert/strict";
import test from "node:test";
import {
  clearLicenseAdmin,
  isLicenseAdmin,
  isLicenseAdminConfigured,
  markLicenseAdmin,
  verifyLicenseAdmin
} from "../website/lib/licenseAuth.js";

test("license admin credentials are verified safely", () => {
  const config = { licenseAdminId: "operator", licenseAdminPassword: "secret-value" };
  assert.equal(isLicenseAdminConfigured(config), true);
  assert.equal(verifyLicenseAdmin(config, "operator", "secret-value"), true);
  assert.equal(verifyLicenseAdmin(config, "operator", "wrong"), false);
  assert.equal(verifyLicenseAdmin(config, "other", "secret-value"), false);
  assert.equal(isLicenseAdminConfigured({}), false);
});

test("license admin session flag can be marked and cleared", () => {
  const req = { session: {} };
  assert.equal(isLicenseAdmin(req), false);
  markLicenseAdmin(req);
  assert.equal(isLicenseAdmin(req), true);
  clearLicenseAdmin(req);
  assert.equal(isLicenseAdmin(req), false);
});
