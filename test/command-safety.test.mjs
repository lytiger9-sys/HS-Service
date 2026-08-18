import test from "node:test";
import assert from "node:assert/strict";
import { commandMap } from "../src/bot/commands/index.js";
import { PLAN_TAB_LABELS, getPlanDefinition } from "../src/config/plans.js";

function option(commandName, optionName) {
  return commandMap.get(commandName)?.data.toJSON().options?.find((item) => item.name === optionName);
}

test("일괄 변경·삭제 명령어는 확인 옵션을 요구한다", () => {
  for (const commandName of ["clear", "복제", "카테고리삭제", "nickrandom", "nickinit", "이모지삭제", "사운드삭제"]) {
    assert.equal(option(commandName, "확인")?.required, true, `${commandName} 확인 옵션 누락`);
  }
});

test("생일설정 명령어는 등록되지 않는다", () => {
  assert.equal(commandMap.has("생일설정"), false);
  assert.ok(commandMap.has("생일"));
});

test("닉네임 일괄 적용 명령어가 등록되어 있다", () => {
  assert.ok(commandMap.has("nickapply"));
  assert.equal(PLAN_TAB_LABELS.embed, "임베드");
});

test("허니팟은 대시보드 탭에서 제외할 수 있는 기능 게이트로 유지된다", () => {
  assert.equal(getPlanDefinition("free").tabs.includes("honeypot"), true);
});
