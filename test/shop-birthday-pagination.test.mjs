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

test("이모지 목록 payload에 이전·다음 화살표가 포함된다", () => {
  const payload = buildEmojiListPayload(Array.from({ length: 45 }, (_, index) => ({ id: String(index), name: `emoji-${index}`, toString: () => `:emoji-${index}:` })), 2, "user-1");
  assert.equal(payload.ephemeral, true);
  assert.equal(payload.components[0].components.length, 2);
  assert.match(payload.content, /페이지 2\/3/);
});
