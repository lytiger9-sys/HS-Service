const FEATURE_ALIASES = {
  administrators: "administrators",
  staff: "administrators",
  assignment: "assignment",
  notice: "embed"
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
    id: "basic",
    label: "Basic",
    description: "기본 서버 관리 기능",
    order: 2,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "assignment", "voice", "honeypot", "embed", "polls", "logs", "nickname"]
  },
  {
    id: "standard",
    label: "Standard",
    description: "성장 서버 운영 기능",
    order: 3,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "security", "assignment", "voice", "honeypot", "embed", "polls", "logs", "nickname", "events"]
  },
  {
    id: "pro",
    label: "Pro",
    description: "고급 서버 운영 및 파트너 기능",
    order: 4,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "security", "assignment", "voice", "honeypot", "embed", "polls", "logs", "partner", "nickname", "events"]
  },
  {
    id: "enterprise",
    label: "Enterprise",
    description: "전체 기능 및 확장 운영",
    order: 5,
    allowFeatureToggle: true,
    tabs: ["overview", "administrators", "welcome", "ticket", "security", "assignment", "voice", "honeypot", "embed", "polls", "logs", "partner", "nickname", "shop", "events"],
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
  shop: "상점"
};

export function normalizeFeatureId(feature) {
  return FEATURE_ALIASES[feature] || feature;
}

export function getPlanDefinition(planId) {
  return PLAN_DEFINITIONS.find((plan) => plan.id === planId) || PLAN_DEFINITIONS[0];
}
