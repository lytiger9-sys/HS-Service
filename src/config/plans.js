export const PLAN_DEFINITIONS = [
  { id: "free", label: "Free", description: "기본 기능", order: 1, tabs: ["overview"] },
  { id: "basic", label: "Basic", description: "개인 서버 운영", order: 2, tabs: ["overview", "welcome", "notice"] },
  { id: "standard", label: "Standard", description: "성장 서버 운영", order: 3, tabs: ["overview", "welcome", "notice", "security", "ticket", "polls"] },
  { id: "pro", label: "Pro", description: "고급 관리 기능", order: 4, tabs: ["overview", "welcome", "notice", "security", "ticket", "polls", "partner", "nickname", "embed"] },
  { id: "enterprise", label: "Enterprise", description: "전체 기능 및 확장 운영", order: 5, tabs: ["overview", "welcome", "notice", "security", "ticket", "polls", "partner", "nickname", "embed", "events", "shop"] }
];

export const PLAN_IDS = new Set(PLAN_DEFINITIONS.map((plan) => plan.id));
export const PLAN_LABELS = Object.fromEntries(PLAN_DEFINITIONS.map((plan) => [plan.id, plan.label]));
export const PLAN_TAB_LABELS = {
  overview: "개요",
  welcome: "환영 메시지",
  notice: "공지",
  security: "보안",
  ticket: "티켓",
  polls: "투표",
  partner: "파트너",
  nickname: "닉네임",
  embed: "임베드 전송",
  events: "이벤트",
  shop: "상점"
};

export function getPlanDefinition(planId) {
  return PLAN_DEFINITIONS.find((plan) => plan.id === planId) || PLAN_DEFINITIONS[0];
}
