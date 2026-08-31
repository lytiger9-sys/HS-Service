import assert from "node:assert/strict";
import test from "node:test";
import { ChannelType } from "discord.js";
import { isOverviewStatsChannel } from "../src/services/serverAuditLogService.js";

const overviewCategory = { id: "overview-category", name: "개요" };

function voiceChannel(name, parent = overviewCategory) {
  return {
    id: "voice-channel",
    name,
    type: ChannelType.GuildVoice,
    parentId: parent?.id || null,
    parent
  };
}

test("개요 카테고리의 서버 스탯 음성 채널은 변경 로그에서 제외한다", () => {
  assert.equal(isOverviewStatsChannel(voiceChannel("전체 인원 수: 100명")), true);
  assert.equal(isOverviewStatsChannel(voiceChannel("봇 수: 5개")), true);
  assert.equal(isOverviewStatsChannel(voiceChannel("인원 수: 95명")), true);
  assert.equal(isOverviewStatsChannel(voiceChannel("인원수: 95명")), true);
});

test("일반 음성 채널과 개요 이외 카테고리의 음성 채널은 로그 대상이다", () => {
  assert.equal(isOverviewStatsChannel(voiceChannel("일반 음성: 1명")), false);
  assert.equal(isOverviewStatsChannel(voiceChannel("전체 인원 수: 100명", { id: "general", name: "일반" })), false);
  assert.equal(isOverviewStatsChannel({ name: "전체 인원 수: 100명", type: ChannelType.GuildText, parent: overviewCategory }), false);
});
