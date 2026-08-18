import test from "node:test";
import assert from "node:assert/strict";
import { formatKstDateTime, kstDateKey, kstDateParts } from "../src/shared/time.js";

test("KST 날짜 키는 UTC 날짜 경계를 한국시간으로 처리한다", () => {
  const value = "2026-08-18T15:30:00.000Z";
  assert.equal(kstDateKey(value), "2026-08-19");
  assert.deepEqual(kstDateParts(value), { year: 2026, month: 8, day: 19, hour: 0, minute: 30, second: 0 });
});

test("KST 날짜시간 표시에는 한국시간 기준 시각이 들어간다", () => {
  assert.match(formatKstDateTime("2026-08-18T15:30:00.000Z"), /2026.*8.*19.*오전 12:30/);
});
