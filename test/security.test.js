import assert from "node:assert/strict";
import test from "node:test";
import { applySecurityHeaders, csrfProtection, ensureCsrfToken } from "../website/lib/security.js";

function responseMock() {
  return {
    headers: {},
    cookies: {},
    locals: {},
    statusCode: 200,
    setHeader(name, value) { this.headers[name] = value; },
    set(name, value) { this.headers[name] = value; },
    cookie(name, value, options) { this.cookies[name] = { value, options }; },
    status(code) { this.statusCode = code; return this; },
    send(value) { this.body = value; return this; }
  };
}

function requestMock(overrides = {}) {
  const request = {
    method: "GET",
    session: {},
    body: {},
    secure: true,
    get(name) {
      return this.headers?.[name.toLowerCase()] || "";
    },
    headers: {},
    ...overrides
  };
  return request;
}

test("security headers are applied", () => {
  const res = responseMock();
  let called = false;
  applySecurityHeaders({}, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
});

test("CSRF token is created in session and cookie", () => {
  const req = requestMock();
  const res = responseMock();
  ensureCsrfToken(req, res, () => {});
  assert.match(req.session.csrfToken, /^[a-f0-9]{64}$/);
  assert.equal(res.cookies["csrf-token"].value, req.session.csrfToken);
});

test("CSRF protection rejects missing or invalid tokens", () => {
  const req = requestMock({ method: "POST", session: { csrfToken: "a".repeat(64) } });
  const res = responseMock();
  let called = false;
  csrfProtection(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);

  req.body._csrf = "b".repeat(64);
  const secondRes = responseMock();
  csrfProtection(req, secondRes, () => { called = true; });
  assert.equal(secondRes.statusCode, 403);
});

test("CSRF protection accepts a matching token", () => {
  const token = "a".repeat(64);
  const req = requestMock({ method: "POST", session: { csrfToken: token }, body: { _csrf: token } });
  const res = responseMock();
  let called = false;
  csrfProtection(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(res.statusCode, 200);
});
