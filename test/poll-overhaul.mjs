import assert from "node:assert/strict";
import test from "node:test";
import { createPollService } from "../src/services/pollService.js";

function createHarness() {
  const state = { guilds: {} };
  const context = {
    client: { guilds: { fetch: async () => null, cache: new Map() } },
    services: {
      settings: { getSettings: async () => ({ polls: { enabled: true } }) },
      logs: { sendLogByKey: async () => null, editLogByKey: async () => null }
    }
  };
  const guildState = {
    ensure: async (guildId) => { state.guilds[guildId] ??= { polls: {} }; },
    snapshot: (guildId) => state.guilds[guildId],
    patch: async (guildId, updater) => {
      await guildState.ensure(guildId);
      return updater(state.guilds[guildId]);
    }
  };
  return { service: createPollService(context, guildState), state };
}

test("자유 입력은 기존 선택지를 대체하지 않고 별도 항목으로 추가된다", async () => {
  const { service } = createHarness();
  const poll = await service.createPoll("guild", { question: "선택", options: ["A", "B"], freeTextEnabled: true });
  assert.deepEqual(poll.options.map((option) => option.label), ["A", "B", "자유 입력"]);
  assert.equal(poll.options[2].isFreeText, true);
  assert.equal(poll.options[1].isFreeText, false);
});

test("Components V2 투표 버튼은 자유 입력 항목을 별도 customId로 만든다", async () => {
  const { service } = createHarness();
  const poll = await service.createPoll("guild", { question: "선택", options: ["A", "B"], freeTextEnabled: true });
  const components = service.buildPollComponents(poll).flatMap((row) => row.toJSON().components);
  assert.equal(components.at(-1).custom_id, `poll:${poll.id}:free`);
  assert.equal(components.length, 3);
});
