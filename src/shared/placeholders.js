function stringify(value) {
  if (value == null) return "";
  return String(value);
}

function formatKoreanDateTime(value) {
  if (!value) return "알 수 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "알 수 없음";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const period = parts.dayPeriod === "PM" ? "오후" : "오전";
  return `${parts.year}년 ${Number(parts.month)}월 ${Number(parts.day)}일 ${period} ${parts.hour}:${parts.minute}`;
}

function formatRelativeTime(value, now = Date.now()) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "알 수 없음";
  const elapsedSeconds = Math.max(0, Math.floor((Number(now) - timestamp) / 1000));
  if (elapsedSeconds < 60) return "방금 전";

  const units = [
    [365 * 24 * 60 * 60, "년"],
    [30 * 24 * 60 * 60, "달"],
    [24 * 60 * 60, "일"],
    [60 * 60, "시간"],
    [60, "분"]
  ];
  const [seconds, label] = units.find(([seconds]) => elapsedSeconds >= seconds) || units.at(-1);
  return `${Math.floor(elapsedSeconds / seconds)}${label} 전`;
}

export function applyPlaceholders(template, context = {}) {
  const joinedAt = context.joinedAt ?? context.member?.joinedAt;
  const accountCreatedAt = context.accountCreatedAt ?? context.user?.createdAt;
  const inviter = context.inviter || null;
  const replacements = {
    user: stringify(context.user?.toString?.() ?? context.userTag ?? context.username),
    username: stringify(context.user?.username ?? context.username),
    guild: stringify(context.guild?.name ?? context.guildName),
    totalmember: stringify(context.totalmember ?? context.totalMembers ?? context.memberCount),
    joinedat: formatKoreanDateTime(joinedAt),
    joinedrelative: formatRelativeTime(joinedAt, context.now),
    accountcreatedat: formatKoreanDateTime(accountCreatedAt),
    accountcreatedrelative: formatRelativeTime(accountCreatedAt, context.now),
    inviter: stringify(inviter?.mention ?? (inviter?.id ? `<@${inviter.id}>` : "초대자를 확인할 수 없음")),
    invitername: stringify(inviter?.username ?? "알 수 없음")
  };

  return stringify(template).replace(/\{(user|username|guild|totalmember|joinedat|joinedrelative|accountcreatedat|accountcreatedrelative|inviter|invitername)\}/g, (_match, key) => replacements[key] ?? "");
}
