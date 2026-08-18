import assert from "node:assert/strict";
import test from "node:test";
import { applySecurityHeaders } from "../website/lib/security.js";

function responseMock() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; }
  };
}

test("security headers are applied", () => {
  const res = responseMock();
  let called = false;
  applySecurityHeaders({}, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
});
