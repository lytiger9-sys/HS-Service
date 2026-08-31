import assert from "node:assert/strict";
import test from "node:test";
import { MessageFlags } from "discord.js";
import { convertLegacyPayload, createBaseEmbed } from "../src/shared/embeds.js";

test("기존 임베드 변환은 원래 색상을 Components V2 Accent Color로 보존한다", () => {
  const payload = convertLegacyPayload({
    embeds: [createBaseEmbed({ title: "색상 확인", description: "메시지", color: 0xd08c3f })]
  });
  const container = payload.components[0].toJSON();

  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.equal(container.accent_color, 0xd08c3f);
});
