import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { bannerComponents, conditionComponents } from "../src/services/partnerService.js";

const settings = {
  embedTitle: "파트너 모집",
  embedDescription: "파트너 조건",
  embedColor: "#3a7da8",
  buttonLabel: "파트너 신청"
};

test("partner conditions use Components V2 payloads", () => {
  const payload = conditionComponents(settings);
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.equal(payload.components[0].toJSON().type, 17);
  const json = payload.components[0].toJSON();
  assert.ok(json.components.some((component) => component.type === 10));
  assert.ok(json.components.some((component) => component.type === 14));
  assert.ok(json.components.some((component) => component.type === 1));
});

test("banner payload uses Components V2 without legacy embeds", () => {
  const payload = bannerComponents({ ...settings, embedTitle: "상단 배너", embedColor: "#b89968" }, {
    serverName: "테스트 서버",
    serverLink: "https://example.com",
    promoWebhook: "https://discord.com/api/webhooks/example"
  });
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.equal(payload.embeds, undefined);
  assert.equal(payload.components[0].toJSON().type, 17);
});
