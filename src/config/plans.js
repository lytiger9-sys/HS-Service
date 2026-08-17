export const PLAN_DEFINITIONS = [
  { id: "free", label: "Free", description: "기본 기능", order: 1 },
  { id: "basic", label: "Basic", description: "개인 서버 운영", order: 2 },
  { id: "standard", label: "Standard", description: "성장 서버 운영", order: 3 },
  { id: "pro", label: "Pro", description: "고급 관리 기능", order: 4 },
  { id: "enterprise", label: "Enterprise", description: "전체 기능 및 확장 운영", order: 5 }
];

export const PLAN_IDS = new Set(PLAN_DEFINITIONS.map((plan) => plan.id));
export const PLAN_LABELS = Object.fromEntries(PLAN_DEFINITIONS.map((plan) => [plan.id, plan.label]));
