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
