import crypto from "node:crypto";

const CSRF_SESSION_KEY = "csrfToken";
const CSRF_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 7;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const rateBuckets = new Map();

function readCookie(req, name) {
  const header = req.get("cookie") || "";
  const entry = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : "";
}

export function applySecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
}

export function ensureCsrfToken(req, res, next) {
  if (req.session) {
    req.session[CSRF_SESSION_KEY] ??= crypto.randomBytes(32).toString("hex");
    res.locals.csrfToken = req.session[CSRF_SESSION_KEY];
    res.cookie("csrf-token", req.session[CSRF_SESSION_KEY], {
      httpOnly: false,
      sameSite: "lax",
      secure: req.secure,
      maxAge: CSRF_COOKIE_MAX_AGE
    });
  }
  next();
}

export function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const expected = req.session?.[CSRF_SESSION_KEY];
  const provided = req.body?._csrf || req.get("x-csrf-token") || readCookie(req, "csrf-token");
  const expectedBuffer = Buffer.from(String(expected || ""));
  const providedBuffer = Buffer.from(String(provided || ""));
  const matches = expectedBuffer.length === providedBuffer.length
    && expectedBuffer.length > 0
    && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  if (!matches) {
    return res.status(403).render("csrf-expired", {
      title: "보안 토큰 만료",
      message: "보안 토큰이 만료되었거나 이미 사용된 페이지에서 요청되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."
    });
  }
  return next();
}

export function requestRateLimit(req, res, next) {
  const key = `${req.ip}:${req.path}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", "60");
    return res.status(429).send("요청이 너무 많습니다. 잠시 후 다시 시도하세요.");
  }
  return next();
}

export function clearExpiredRateBuckets() {
  const threshold = Date.now() - WINDOW_MS;
  for (const [key, bucket] of rateBuckets) {
    if (bucket.startedAt < threshold) rateBuckets.delete(key);
  }
}

const cleanupTimer = setInterval(clearExpiredRateBuckets, WINDOW_MS);
cleanupTimer.unref();
