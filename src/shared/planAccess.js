import { getPlanDefinition } from "../config/plans.js";

export const FEATURE_LABELS = {
  welcome: "환영 메시지",
  notice: "공지",
  security: "보안",
  ticket: "티켓",
  polls: "투표",
  partner: "파트너",
  nickname: "닉네임",
  embed: "임베드 전송",
  events: "이벤트",
  shop: "상점",
  assignment: "메시지 역할",
  voice: "임시 음성 채널",
  honeypot: "허니팟",
  logs: "로그"
};

export function planHasFeature(planId, feature) {
  return getPlanDefinition(planId).tabs.includes(feature);
}

export function interactionFeature(customId = "") {
  const scope = String(customId).split(":")[0];
  if (scope === "partner") return "partner";
  if (scope === "ticket") return "ticket";
  if (scope === "poll") return "polls";
  if (scope === "staff") return null;
  return null;
}

export async function getGuildPlanAccess(context, guildId) {
  if (String(guildId) === String(context.config.allowedGuildId)) {
    return { allowed: true, bypass: true, plan: "enterprise", reason: "management-guild" };
  }
  const license = await context.services.licenses.getActiveByGuild(guildId).catch(() => null);
  if (!license) return { allowed: false, bypass: false, plan: null, reason: "license-required" };
  return { allowed: true, bypass: false, plan: license.plan, license, reason: "licensed" };
}

export async function canUseFeature(context, guildId, feature) {
  const access = await getGuildPlanAccess(context, guildId);
  return { ...access, feature, featureAllowed: access.allowed && (access.bypass || planHasFeature(access.plan, feature)) };
}

export function featureDeniedMessage(feature) {
  return `${FEATURE_LABELS[feature] || "이 기능"}은 현재 라이선스 플랜에서 사용할 수 없습니다.`;
}
