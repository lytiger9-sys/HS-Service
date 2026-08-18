import test from "node:test";
import assert from "node:assert/strict";
import { commandMap } from "../src/bot/commands/index.js";
import { buildEmojiListPayload } from "../src/bot/commands/emoji.js";

test("생일 명령어가 상점 명령어 목록에 등록되어 있다", () => {
  const birthday = commandMap.get("생일");
  assert.ok(birthday);
  const options = birthday.data.toJSON().options;
  assert.deepEqual(options.map((option) => option.name), ["월", "일"]);
});

test("이모지 목록 payload가 joinorder 형식의 임베드와 페이지 버튼을 사용한다", () => {
  const payload = buildEmojiListPayload(Array.from({ length: 25 }, (_, index) => ({ id: String(index), name: `emoji-${index}`, toString: () => `:emoji-${index}:` })), 1, "user-1");
  assert.equal(payload.ephemeral, true);
  assert.equal(payload.embeds.length, 1);
  assert.match(payload.embeds[0].data.title, /서버 이모지 목록/);
  assert.match(payload.embeds[0].data.description, /emoji-10/);
  assert.doesNotMatch(payload.embeds[0].data.description, /10$/);
  assert.equal(payload.components[0].components.length, 3);
  assert.match(payload.components[0].components[1].data.label, /2\/3/);
});
