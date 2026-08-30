export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const UNIT_TO_MINUTES = {
  minutes: 1,
  hours: MINUTES_PER_HOUR,
  days: MINUTES_PER_DAY
};

const KOREAN_UNITS = {
  "분": "minutes",
  "시간": "hours",
  "일": "days"
};

function asFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function parseDurationMinutes(value, { defaultUnit = "minutes", minMinutes = 0, maxMinutes = Infinity, fieldLabel = "시간" } = {}) {
  const fallbackMultiplier = UNIT_TO_MINUTES[defaultUnit];
  if (!fallbackMultiplier) throw new Error("지원하지 않는 기본 시간 단위입니다.");

  const source = String(value ?? "").trim();
  const match = source.match(/^(\d+(?:\.\d+)?)\s*(분|시간|일)?$/);
  if (!match) throw new Error(`${fieldLabel}은 숫자 또는 숫자 뒤에 분·시간·일 단위를 입력해 주세요.`);

  const amount = asFiniteNumber(match[1]);
  const explicitUnit = match[2] ? KOREAN_UNITS[match[2]] : defaultUnit;
  const minutes = Math.round(amount * UNIT_TO_MINUTES[explicitUnit]);
  if (!Number.isFinite(minutes) || minutes < minMinutes || minutes > maxMinutes) {
    throw new Error(`${fieldLabel}은 ${formatDurationMinutes(minMinutes)}부터 ${formatDurationMinutes(maxMinutes)} 사이로 입력해 주세요.`);
  }
  return minutes;
}

export function formatDurationMinutes(value) {
  const minutes = Math.round(Number(value) || 0);
  if (minutes === 0) return "0분";
  if (minutes > 0 && minutes % MINUTES_PER_DAY === 0) return `${minutes / MINUTES_PER_DAY}일`;
  if (minutes > 0 && minutes % MINUTES_PER_HOUR === 0) return `${minutes / MINUTES_PER_HOUR}시간`;
  return `${minutes}분`;
}

export function durationToStoredUnit(value, { defaultUnit, storageUnit, minMinutes, maxMinutes, fieldLabel }) {
  const minutes = parseDurationMinutes(value, { defaultUnit, minMinutes, maxMinutes, fieldLabel });
  const divisor = UNIT_TO_MINUTES[storageUnit];
  if (!divisor) throw new Error("지원하지 않는 저장 시간 단위입니다.");
  return minutes / divisor;
}

export function storedDurationToMinutes(value, storageUnit = "minutes") {
  const multiplier = UNIT_TO_MINUTES[storageUnit];
  if (!multiplier) return 0;
  return Math.round((Number(value) || 0) * multiplier);
}
