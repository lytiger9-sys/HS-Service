import test from "node:test";
import assert from "node:assert/strict";
import { durationToStoredUnit, formatDurationMinutes, parseDurationMinutes, storedDurationToMinutes } from "../src/shared/duration.js";

test("분·시간·일 단위 입력을 분으로 변환한다", () => {
  assert.equal(parseDurationMinutes("60분", { defaultUnit: "minutes" }), 60);
  assert.equal(parseDurationMinutes("1시간", { defaultUnit: "minutes" }), 60);
  assert.equal(parseDurationMinutes("2일", { defaultUnit: "minutes" }), 2880);
});

test("단위 없는 숫자는 항목별 기본 단위로 해석한다", () => {
  assert.equal(parseDurationMinutes("30", { defaultUnit: "minutes" }), 30);
  assert.equal(parseDurationMinutes("7", { defaultUnit: "days" }), 10080);
  assert.equal(parseDurationMinutes("24", { defaultUnit: "hours" }), 1440);
});

test("저장 후에는 일·시간·분 중 가장 읽기 쉬운 단위로 표시한다", () => {
  assert.equal(formatDurationMinutes(60), "1시간");
  assert.equal(formatDurationMinutes(1440), "1일");
  assert.equal(formatDurationMinutes(90), "90분");
  assert.equal(formatDurationMinutes(0), "0분");
});

test("기존 저장 단위를 유지하면서 단위 입력을 변환한다", () => {
  assert.equal(durationToStoredUnit("24시간", { defaultUnit: "days", storageUnit: "days", minMinutes: 1440, maxMinutes: 525600, fieldLabel: "투표 만료 기간" }), 1);
  assert.equal(durationToStoredUnit("1일", { defaultUnit: "hours", storageUnit: "hours", minMinutes: 60, maxMinutes: 43200, fieldLabel: "이벤트 기한" }), 24);
  assert.equal(durationToStoredUnit("1", { defaultUnit: "days", storageUnit: "minutes", minMinutes: 1, maxMinutes: 10080, fieldLabel: "자동 전송 주기" }), 1440);
  assert.equal(storedDurationToMinutes(24, "hours"), 1440);
});

test("허용 범위 밖이거나 단위 형식이 잘못된 입력은 명확히 거부한다", () => {
  assert.throws(() => parseDurationMinutes("한시간", { defaultUnit: "minutes", fieldLabel: "테스트 시간" }), /숫자 또는 숫자 뒤에 분·시간·일/);
  assert.throws(() => parseDurationMinutes("8일", { defaultUnit: "days", maxMinutes: 10080, fieldLabel: "자동 전송 주기" }), /자동 전송 주기/);
});
