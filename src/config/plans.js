const FEATURE_ALIASES = {
  administrators: "administrators",
  staff: "administrators",
  assignment: "assignment",
  notice: "embed"
};

// 신규 판매 플랜에서는 Enterprise를 제거했습니다. 마이그레이션 전 남아 있는
// Enterprise 라이선스는 Pro 권한으로 해석해 기존 고객 기능이 축소되지 않게 합니다.
const LEGACY_PLAN_ALIASES = {
  enterprise: "pro"
};

export const PLAN_DEFINITIONS = [
  {
    id: "free",
    label: "Free",
    description: "기본 서버 운영 기능",
    order: 1,
    allowFeatureToggle: false,
    tabs: ["overview", "administrators", "assignment", "voice", "honeypot", "embed", "polls"]
  },
  {
    id: "standard",
    label: "Standard",
    description: "기본 서버 관리 기능",
    order: 2,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "assignment", "voice", "honeypot", "embed", "polls", "logs", "nickname"]
  },
  {
    id: "pro",
    label: "Pro",
    description: "보안·이벤트·파트너·상점·구매로그/후기를 포함한 전체 서버 운영 기능",
    order: 3,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "security", "assignment", "voice", "honeypot", "embed", "polls", "logs", "partner", "nickname", "shop", "events", "purchaseFeedback"],
    includesFutureFeatures: true
  }
];

export const PLAN_IDS = new Set(PLAN_DEFINITIONS.map((plan) => plan.id));
export const PLAN_LABELS = Object.fromEntries(PLAN_DEFINITIONS.map((plan) => [plan.id, plan.label]));
export const PLAN_TAB_LABELS = {
  overview: "개요",
  administrators: "관리자",
  welcome: "환영",
  ticket: "티켓",
  security: "보안",
  assignment: "역할",
  voice: "음성",
  honeypot: "허니팟",
  polls: "투표",
  logs: "로그",
  partner: "파트너",
  nickname: "닉네임",
  embed: "임베드",
  events: "이벤트",
  shop: "상점",
  purchaseFeedback: "구매로그/후기"
};

export function normalizeFeatureId(feature) {
  return FEATURE_ALIASES[feature] || feature;
}

export function getPlanDefinition(planId) {
  const normalizedPlanId = LEGACY_PLAN_ALIASES[planId] || planId;
  return PLAN_DEFINITIONS.find((plan) => plan.id === normalizedPlanId) || PLAN_DEFINITIONS[0];
}
