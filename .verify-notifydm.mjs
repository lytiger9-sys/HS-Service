import assert from "node:assert/strict";
import notifydm, { handleNotifyDmModal } from "./src/bot/commands/notifydm.js";

const commandData = notifydm.data.toJSON();
assert.equal(commandData.name, "공지dm");
assert.equal(commandData.options?.[0]?.type, 6);
assert.equal(commandData.options?.[0]?.name, "대상");
assert.equal(commandData.options?.[0]?.required, true);

let modal;
await notifydm.execute({
  memberPermissions: { has: () => true },
  options: { getUser: () => ({ id: "12345678901234567", bot: false }) },
  showModal: async (value) => { modal = value; }
});
assert.equal(modal.data.custom_id, "notifydm:compose:12345678901234567");

let sentPayload;
let resultMessage;
let deferred = false;
const handled = await handleNotifyDmModal({
  customId: "notifydm:compose:12345678901234567",
  memberPermissions: { has: () => true },
  fields: { getTextInputValue: () => " 테스트 공지 " },
  deferReply: async () => { deferred = true; },
  editReply: async ({ content }) => { resultMessage = content; },
  client: {
    users: {
      fetch: async (id) => ({
        id,
        bot: false,
        send: async (payload) => { sentPayload = payload; }
      })
    }
  }
});
assert.equal(handled, true);
assert.equal(deferred, true);
assert.deepEqual(sentPayload, { content: "테스트 공지", allowedMentions: { parse: [] } });
assert.match(resultMessage, /공지 DM을 보냈습니다/);
assert.equal(await handleNotifyDmModal({ customId: "unrelated:modal" }), false);

console.log("notifydm verification passed");
