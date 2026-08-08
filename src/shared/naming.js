export function slugifyDiscordName(input, fallback = "channel") {
  const value = String(input ?? "")
    .trim()
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣-_ ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return value.slice(0, 90) || fallback;
}

export function clampText(input, limit) {
  const text = String(input ?? "");
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
