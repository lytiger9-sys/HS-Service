const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;
const rateBuckets = new Map();

export function applySecurityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
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
