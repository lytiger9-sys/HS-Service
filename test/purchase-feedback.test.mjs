import assert from "node:assert/strict";
import test from "node:test";
import { MessageFlags } from "discord.js";
import { createPurchaseFeedbackService } from "../src/services/purchaseFeedbackService.js";

function createService() {
  return createPurchaseFeedbackService(
    {
      services: {
        settings: {
          async getSettings() { return {}; },
          async updateSettings() { return {}; }
        }
      },
      client: { guilds: { cache: new Map() } }
    },
    {
      snapshot() { return { purchaseFeedback: { pending: {}, history: [] } }; },
      async patch() {}
    }
  );
}

test("후기 양식은 콜론 유무와 관계없이 줄바꿈 뒤의 내용을 읽는다", () => {
  const service = createService();
  assert.equal(service.parseReview("후기:\n상품을 잘 받았습니다."), "상품을 잘 받았습니다.");
  assert.equal(service.parseReview("후기\n빠른 배송 감사합니다."), "빠른 배송 감사합니다.");
  assert.equal(service.parseReview("상품을 잘 받았습니다."), "");
});

test("구매로그/후기 메시지는 Components V2 컨테이너로 생성된다", () => {
  const service = createService();
  const payload = service.buildComponentsPayload("# 구매 로그\n--\n유저\n<@123>", { userId: "123" });
  const container = payload.components[0].toJSON();

  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.equal(container.type, 17);
  assert.equal(container.components.some((component) => component.type === 14), true);
  assert.deepEqual(payload.allowedMentions, { parse: [], users: ["123"] });
});
