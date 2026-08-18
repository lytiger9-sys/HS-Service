export const KST_TIME_ZONE = "Asia/Seoul";

function partsOf(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function kstDateParts(value = new Date()) {
  const parts = partsOf(value);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second) };
}

export function kstDateKey(value = new Date()) {
  const parts = kstDateParts(value);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatKst(value, options = {}) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST_TIME_ZONE, ...options }).format(new Date(value));
}

export function formatKstDateTime(value) {
  return formatKst(value, { dateStyle: "medium", timeStyle: "short" });
}
