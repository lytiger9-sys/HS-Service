import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags } from "discord.js";
import { createServerAuditLogService } from "../src/services/serverAuditLogService.js";

function makeMember(id, tag, roleIds) {
  const roles = new Map(roleIds.map((roleId) => [roleId, { id: roleId }]));
  return { id, user: { tag }, guild: { id: "guild-1" }, roles: { cache: roles }, toString: () => `<@${id}>` };
}

function captureService() {
  const sent = [];
  const service = createServerAuditLogService({ services: { logs: { sendLogByKey: async (_guildId, _key, payload) => { sent.push(payload); return payload; } } } });
  return { service, sent };
}

test("서버 정보 변경 로그는 Components V2 payload를 사용한다", async () => {
  const { service, sent } = captureService();
  await service.handleGuildUpdate({ id: "guild-1", name: "이전", icon: "old", banner: "old-banner" }, { id: "guild-1", name: "이후", icon: "new", banner: "new-banner" });
  assert.equal(sent[0].flags, MessageFlags.IsComponentsV2);
  assert.equal(sent[0].embeds, undefined);
  assert.ok(sent[0].components.length > 0);
});

test("역할 지급·회수 로그는 Components V2 payload를 사용한다", async () => {
  const { service, sent } = captureService();
  await service.handleMemberUpdate(makeMember("user-1", "사용자#0001", ["guild-1", "role-old"]), makeMember("user-1", "사용자#0001", ["guild-1", "role-new"]));
  assert.equal(sent[0].flags, MessageFlags.IsComponentsV2);
  assert.equal(sent[0].embeds, undefined);
  assert.equal(sent[0].allowedMentions.parse.length, 0);
});
