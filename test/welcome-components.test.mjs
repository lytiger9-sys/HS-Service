import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { createDefaultGuildSettings } from "../src/config/defaults.js";
import { buildWelcomeEmbeds } from "../src/shared/embeds.js";
import { applyPlaceholders } from "../src/shared/placeholders.js";
import { createInviteTrackerService } from "../src/services/inviteTrackerService.js";

function flattenContents(node, output = []) {
  if (node?.content) output.push(node.content);
  for (const child of node?.components || []) flattenContents(child, output);
  return output;
}

test("환영 기본값은 요청한 Components V2 템플릿과 새 변수를 사용한다", () => {
  const welcome = createDefaultGuildSettings().welcome;
  assert.equal(welcome.embedTitle, "");
  assert.match(welcome.embedDescription, /# \{totalmember\}번째 멤버가 입장했어요/);
  assert.match(welcome.embedDescription, /\{joinedat\}/);
  assert.match(welcome.embedDescription, /\{accountcreatedat\}/);
  assert.match(welcome.embedDescription, /\{inviter\}/);
});

test("환영 메시지는 시간·계정 생성일·초대자를 포함한 Components V2 페이로드를 만든다", () => {
  const settings = createDefaultGuildSettings();
  const member = {
    id: "123456789012345",
    joinedAt: new Date("2026-08-30T11:42:00.000Z"),
    user: {
      id: "123456789012345",
      username: "새유저",
      createdAt: new Date("2026-06-12T11:31:00.000Z"),
      toString: () => "<@123456789012345>",
      displayAvatarURL: () => "https://cdn.example.com/user.png"
    }
  };
  const guild = {
    id: "999999999999999",
    name: "테스트 서버",
    memberCount: 42,
    roles: { cache: new Map([["role-1", { id: "role-1", name: "공지" }]]) }
  };
  const payload = buildWelcomeEmbeds(settings, member, guild, { inviter: { id: "222222222222222", username: "초대한유저", mention: "<@222222222222222>" } }).channelEmbed;
  const json = payload.components[0].toJSON();
  const content = flattenContents(json).join("\n");
  assert.equal(payload.flags, MessageFlags.IsComponentsV2);
  assert.match(content, /42번째 멤버가 입장했어요/);
  assert.match(content, /새유저/);
  assert.match(content, /2026년 8월 30일 오후 8:42/);
  assert.match(content, /2026년 6월 12일 오후 8:31/);
  assert.match(content, /<@222222222222222>/);
  assert.match(content, /초대한유저/);
  assert.equal(payload.allowedMentions.users.includes(member.id), true);
  assert.equal(payload.allowedMentions.users.includes("222222222222222"), true);
});

test("초대자를 확인하지 못해도 환영 변수는 안전한 안내 문구로 표시된다", () => {
  const result = applyPlaceholders("{inviter} ({invitername})", { user: { createdAt: Date.now() } });
  assert.equal(result, "초대자를 확인할 수 없음 (알 수 없음)");
});

test("초대 링크 사용량 증가를 통해 초대자 정보를 찾는다", async () => {
  const tracker = createInviteTrackerService();
  let uses = 0;
  const guild = {
    id: "guild-1",
    invites: {
      fetch: async () => new Map([["invite-1", { code: "invite-1", uses, inviter: { id: "222222222222222", username: "초대한유저" } }]])
    }
  };
  await tracker.prime(guild);
  uses = 1;
  const inviter = await tracker.resolveInviter(guild);
  assert.deepEqual(inviter, { id: "222222222222222", username: "초대한유저", mention: "<@222222222222222>" });
});
