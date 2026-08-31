import test from "node:test";
import assert from "node:assert/strict";
import { commandMap } from "../src/bot/commands/index.js";
import { commandFeature } from "../src/bot/interactions/slash.js";
import { PLAN_TAB_LABELS, getPlanDefinition } from "../src/config/plans.js";
import { clearGuildCommandOverrides, syncGlobalCommands } from "../src/bot/syncGlobalCommands.js";

function option(commandName, optionName) {
  return commandMap.get(commandName)?.data.toJSON().options?.find((item) => item.name === optionName);
}

test("일괄 변경·삭제 명령어는 확인 옵션을 요구하고 메시지삭제는 방식 옵션을 요구한다", () => {
  assert.equal(option("메시지삭제", "방식")?.required, true, "메시지삭제 방식 옵션 누락");
  assert.equal(option("메시지삭제", "개수")?.required, false, "메시지삭제 개수 옵션 누락");
  assert.equal(option("메시지삭제", "확인"), undefined, "메시지삭제 확인 옵션이 남아 있음");
  for (const commandName of ["복제", "카테고리삭제", "닉네임랜덤", "닉네임초기화", "이모지삭제", "사운드삭제"]) {
    assert.equal(option(commandName, "확인")?.required, true, `${commandName} 확인 옵션 누락`);
  }
});

test("계좌 명령어가 등록되고 계좌설정은 모달 실행 명령어다", () => {
  assert.ok(commandMap.has("계좌설정"));
  assert.ok(commandMap.has("계좌"));
  assert.deepEqual(commandMap.get("계좌설정").data.toJSON().options ?? [], []);
});

test("생일설정 명령어는 등록되지 않는다", () => {
  assert.equal(commandMap.has("생일설정"), false);
  assert.ok(commandMap.has("생일"));
});

test("점검 모드 명령어 기능 매핑이 실제 탭과 연결된다", () => {
  assert.equal(commandFeature("생일"), "shop");
  assert.equal(commandFeature("사운드목록"), "voice");
  assert.equal(commandFeature("카테고리삭제"), "administrators");
  assert.equal(commandFeature("부스트로그켜기"), "logs");
  assert.equal(commandFeature("파트너메시지"), "partner");
  assert.equal(commandFeature("음성채널생성"), "voice");
});

test("승인된 한글 명령어가 등록되어 있다", () => {
  for (const commandName of ["서버정보", "입장순서", "메시지삭제", "저장", "저장내용", "관리자", "부스트로그켜기", "부스트로그끄기", "음성채널생성", "파트너메시지"]) {
    assert.ok(commandMap.has(commandName), `${commandName} 명령어 누락`);
  }
  assert.equal(PLAN_TAB_LABELS.embed, "임베드");
});

test("전역 명령어 동기화는 현재 전체 명령어 목록을 Discord 애플리케이션에 등록한다", async () => {
  let payload = null;
  const client = {
    application: {
      commands: {
        set: async (commands) => {
          payload = commands;
          return new Map(commands.map((command) => [command.name, command]));
        }
      }
    }
  };
  const registered = await syncGlobalCommands(client, "test");
  assert.equal(registered.size, commandMap.size);
  assert.equal(payload.length, commandMap.size);
  assert.ok(payload.some((command) => command.name === "메시지삭제"));
  assert.equal(payload.some((command) => command.name === "clear"), false);
});

test("전역 등록 전 서버별 이전 명령어 등록을 비운다", async () => {
  const cleared = [];
  const legacyCommands = new Map([["legacy", { name: "clear" }]]);
  const client = {
    guilds: {
      cache: new Map([
        ["guild-1", { id: "guild-1", name: "테스트 서버", commands: { fetch: async () => legacyCommands, set: async (commands) => { cleared.push(commands); } } }],
        ["guild-2", { id: "guild-2", name: "빈 서버", commands: { fetch: async () => new Map(), set: async () => { throw new Error("빈 목록에는 호출되지 않아야 합니다."); } } }]
      ])
    }
  };
  assert.equal(await clearGuildCommandOverrides(client), 1);
  assert.deepEqual(cleared, [[]]);
});

test("허니팟은 대시보드 탭에서 제외할 수 있는 기능 게이트로 유지된다", () => {
  assert.equal(getPlanDefinition("free").tabs.includes("honeypot"), true);
});

test("새 역할·웹훅·이모지·스티커 명령어가 필요한 입력값과 함께 등록된다", () => {
  for (const commandName of ["역할전체지금", "웹훅생성", "이모지확대", "이모지추가", "스티커추가"]) {
    assert.ok(commandMap.has(commandName), `${commandName} 명령어 누락`);
  }
  assert.equal(option("역할전체지금", "역할")?.required, true);
  assert.equal(option("이모지확대", "이모지")?.required, true);
  assert.equal(option("이모지추가", "이모지")?.required, true);
  assert.equal(option("스티커추가", "스티커")?.required, true);
  assert.equal(option("웹훅생성", "이름")?.required, false);
  assert.equal(option("웹훅생성", "프로필")?.required, false);
});

test("새 명령어가 기존 플랜별 접근 제어와 연결된다", () => {
  assert.equal(commandFeature("역할전체지금"), "administrators");
  assert.equal(commandFeature("웹훅생성"), "administrators");
  assert.equal(commandFeature("이모지확대"), "voice");
  assert.equal(commandFeature("이모지추가"), "voice");
  assert.equal(commandFeature("스티커추가"), "voice");
});

test("구매로그 명령어가 필수 입력값과 Pro 전용 후기 기능 게이트로 등록된다", () => {
  assert.ok(commandMap.has("구매로그"));
  assert.equal(option("구매로그", "유저")?.required, true);
  assert.equal(option("구매로그", "제품명")?.required, true);
  assert.equal(commandFeature("구매로그"), "purchaseFeedback");
  assert.equal(getPlanDefinition("pro").tabs.includes("purchaseFeedback"), true);
  assert.equal(getPlanDefinition("standard").tabs.includes("purchaseFeedback"), false);
});
