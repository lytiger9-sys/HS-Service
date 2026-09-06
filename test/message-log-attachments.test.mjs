import assert from "node:assert/strict";
import test from "node:test";
import { buildDeletedAttachmentFiles } from "../src/services/messageLogService.js";

test("삭제된 메시지의 첨부파일을 원본 파일 전송 형식으로 만든다", () => {
  const files = buildDeletedAttachmentFiles({
    attachments: new Map([
      ["one", { url: "https://cdn.discordapp.com/attachments/1/example.png", name: "example.png", description: "예시 이미지", spoiler: false }],
      ["two", { url: "https://cdn.discordapp.com/attachments/2/secret.txt", name: "secret.txt", spoiler: true }]
    ])
  });

  assert.deepEqual(files, [
    {
      attachment: "https://cdn.discordapp.com/attachments/1/example.png",
      name: "example.png",
      description: "예시 이미지",
      spoiler: false
    },
    {
      attachment: "https://cdn.discordapp.com/attachments/2/secret.txt",
      name: "secret.txt",
      description: undefined,
      spoiler: true
    }
  ]);
});

test("첨부파일이 없거나 Discord 한도를 넘는 경우 안전하게 처리한다", () => {
  assert.deepEqual(buildDeletedAttachmentFiles({ attachments: new Map() }), []);
  const attachments = new Map(
    Array.from({ length: 12 }, (_, index) => [String(index), { url: `https://cdn.discordapp.com/attachments/${index}/file.txt`, name: `file-${index}.txt` }])
  );
  assert.equal(buildDeletedAttachmentFiles({ attachments }).length, 10);
});

import { createMessageLogService } from "../src/services/messageLogService.js";
import { convertLegacyPayload } from "../src/shared/embeds.js";

test("삭제 로그는 사진과 일반 파일을 안내 임베드가 있는 같은 메시지에 함께 전송한다", async () => {
  let captured = null;
  const service = createMessageLogService({
    services: {
      logs: {
        async sendLogByKey(guildId, eventKey, payload) {
          captured = { guildId, eventKey, payload };
          return payload;
        }
      }
    }
  });
  const message = {
    guildId: "guild-1",
    channel: { id: "channel-1" },
    author: {
      id: "user-1",
      tag: "user#0001",
      bot: false,
      toString: () => "<@user-1>"
    },
    content: "삭제할 첨부파일 메시지",
    attachments: new Map([
      ["image", { url: "https://cdn.discordapp.com/attachments/1/photo.png", name: "photo.png" }],
      ["document", { url: "https://cdn.discordapp.com/attachments/2/manual.pdf", name: "manual.pdf" }]
    ])
  };

  await service.handleMessageDelete(message);

  assert.equal(captured.guildId, "guild-1");
  assert.equal(captured.eventKey, "messageChange");
  assert.equal(captured.payload.embeds.length, 1);
  assert.deepEqual(captured.payload.files.map((file) => file.name), ["photo.png", "manual.pdf"]);

  const componentsPayload = convertLegacyPayload(captured.payload);
  assert.equal(componentsPayload.files.length, 2);
  assert.deepEqual(componentsPayload.files.map((file) => file.name), ["photo.png", "manual.pdf"]);
});
