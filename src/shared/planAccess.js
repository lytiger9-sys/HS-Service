import { getPlanDefinition, normalizeFeatureId } from "../config/plans.js";

export const FEATURE_LABELS = {
  administrators: "관리자",
  staff: "관리자",
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
  banner: "상단배너 등록",
  assignment: "역할",
  voice: "음성",
  honeypot: "허니팟",
  logs: "로그"
};

export function planHasFeature(planId, feature) {
  return getPlanDefinition(planId).tabs.includes(normalizeFeatureId(feature));
}

export function planAllowsFeatureToggle(planId) {
  return getPlanDefinition(planId).allowFeatureToggle === true;
}

export function interactionFeature(customId = "") {
  const parts = String(customId).split(":");
  const scope = parts[0];
  if (scope === "partner") return "partner";
  if (scope === "banner") return "banner";
  if (scope === "ticket") return "ticket";
  if (scope === "poll" || scope === "poll-free") return "polls";
  if (scope === "staff") return "administrators";
  if (scope === "shop") return "shop";
  if (scope === "save-note") return "ticket";
  if (scope === "page" && ["emoji", "soundboard"].includes(parts[1])) return "voice";
  return null;
}

export async function getGuildPlanAccess(context, guildId) {
  if (String(guildId) === String(context.config.allowedGuildId)) {
    return { allowed: true, bypass: true, plan: "enterprise", reason: "management-guild" };
  }
  const license = await context.services.licenses.getActiveByGuild(guildId).catch(() => null);
  if (!license) return { allowed: false, bypass: false, plan: null, reason: "license-required" };
  if (license.workStopped) return { allowed: false, bypass: false, plan: license.plan, license, reason: "work-stopped" };
  return { allowed: true, bypass: false, plan: license.plan, license, reason: "licensed" };
}

export async function canUseFeature(context, guildId, feature) {
  const access = await getGuildPlanAccess(context, guildId);
  const control = await context.services.adminControl?.get().catch(() => null);
  const featureBanned = !access.bypass && Boolean(control?.featureBans?.[normalizeFeatureId(feature)]);
  const featureAllowed = !featureBanned && (feature === "banner"
    ? access.allowed
    : access.allowed && (access.bypass || planHasFeature(access.plan, feature)));
  return { ...access, feature, featureAllowed, reason: featureBanned ? "feature-ban" : access.reason };
}

export function featureDeniedMessage(feature) {
  return `${FEATURE_LABELS[feature] || "이 기능"}은 현재 라이선스 플랜에서 사용할 수 없습니다.`;
}
