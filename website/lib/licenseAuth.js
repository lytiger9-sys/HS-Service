import crypto from "node:crypto";

const SESSION_KEY = "licenseAdminAuthenticated";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length > 0
    && leftBuffer.length === rightBuffer.length
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isLicenseAdminConfigured(config) {
  return Boolean(config.licenseAdminId && config.licenseAdminPassword);
}

export function isLicenseAdmin(req) {
  return req.session?.[SESSION_KEY] === true;
}

export function requireLicenseAdmin(req, res, next) {
  if (isLicenseAdmin(req)) return next();
  const isFetchRequest = String(req.get("X-Requested-With") || "").toLowerCase() === "fetch"
    || String(req.get("Accept") || "").toLowerCase().includes("application/json");
  if (isFetchRequest) return res.status(401).json({ ok: false, message: "라이선스 관리자 세션이 만료되었습니다. 다시 로그인해 주세요." });
  return res.redirect("/license/login");
}

export function verifyLicenseAdmin(config, id, password) {
  return isLicenseAdminConfigured(config)
    && safeEqual(id, config.licenseAdminId)
    && safeEqual(password, config.licenseAdminPassword);
}

export function markLicenseAdmin(req) {
  req.session[SESSION_KEY] = true;
}

export function clearLicenseAdmin(req) {
  if (req.session) delete req.session[SESSION_KEY];
}
