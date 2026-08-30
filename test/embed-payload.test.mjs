import test from "node:test";
import assert from "node:assert/strict";
import { createEmbedService } from "../src/services/embedService.js";

const guild = {
  id: "123456789012345",
  roles: { cache: new Map() }
};

function buildPayload(settings) {
  const service = createEmbedService({ services: { settings: {} } });
  return service.buildPayload(guild, settings);
}

test("빈 Components V2 임베드는 유효한 기본 안내 문구를 포함한다", () => {
  const payload = buildPayload({ title: "", componentsBody: "", footer: "" });
  const container = payload.components[0].toJSON();

  assert.equal(payload.flags, 32768);
  assert.equal(container.components.length, 1);
  assert.equal(container.components[0].type, 10);
  assert.equal(container.components[0].content, "공지 내용이 아직 설정되지 않았습니다.");
});

test("Components V2 텍스트 영역이 4,000자를 넘으면 명확한 오류를 반환한다", () => {
  assert.throws(
    () => buildPayload({ title: "", componentsBody: "가".repeat(4001), footer: "" }),
    /4,000자 이하/
  );
});

test("특수문자가 포함된 역할명도 유효한 역할 멘션으로 변환한다", () => {
  const role = { id: "123456789012345", name: "Jerry [100,000 W ++]" };
  const roleGuild = {
    id: "987654321098765",
    roles: { cache: new Map([[role.id, role]]) }
  };
  const service = createEmbedService({ services: { settings: {} } });
  const payload = service.buildPayload(roleGuild, {
    title: "이벤트 안내",
    componentsBody: "@Jerry [100,000 W ++] 이벤트를 게시합니다.",
    footer: ""
  });
  const container = payload.components[0].toJSON();

  assert.match(container.components[0].content, /<@&123456789012345>/);
  assert.deepEqual(payload.allowedMentions.roles, ["123456789012345"]);
});

test("https 썸네일 링크는 Components V2 보조 이미지로 직렬화한다", () => {
  const payload = buildPayload({
    title: "이벤트 안내",
    componentsBody: "[thumbnail] https://cdn.example.com/thumbnail.png",
    footer: ""
  });
  const container = payload.components[0].toJSON();

  assert.equal(container.components[1].type, 9);
  assert.equal(container.components[1].accessory.type, 11);
  assert.equal(container.components[1].accessory.media.url, "https://cdn.example.com/thumbnail.png");
});

test("유효하지 않은 썸네일 링크는 Discord 요청 전에 안내 오류를 반환한다", () => {
  assert.throws(
    () => buildPayload({ title: "안내", componentsBody: "[thumbnail] http://example.com/image.png", footer: "" }),
    /썸네일에는 https:\/\//
  );
});

test("Components V2 임베드는 지정한 색상을 컨테이너 Accent Color로 전송한다", () => {
  const payload = buildPayload({
    title: "색상 안내",
    componentsBody: "색상 테스트 메시지",
    color: "#d08c3f",
    footer: ""
  });
  const container = payload.components[0].toJSON();

  assert.equal(container.accent_color, 0xd08c3f);
});
