export type HallTier = {
  level: number;
  maxAttempts: number;
  title: string;
  description: string;
  badge: string;
};

export type HallOfFameRecord = {
  id: string;
  rank: number;
  nickname: string;
  attempts: number;
  comment: string;
  tier: HallTier;
  createdAt: string;
  url: string | null;
};

export const MIN_STORY_ATTEMPTS = 10;

export function normalizeHallAttempts(attempts: number) {
  return Math.max(MIN_STORY_ATTEMPTS, Math.floor(attempts));
}

export const HALL_TIERS: HallTier[] = [
  { level: 1, maxAttempts: 10, title: "지구 구원의 전설", description: "모든 작전을 한 번에 완수한 완벽한 수호자", badge: "/assets/badges/hall-level-01.webp" },
  { level: 2, maxAttempts: 12, title: "궁극의 치료 사령관", description: "거의 흔들림 없이 세계 방어대를 이끈 사령관", badge: "/assets/badges/hall-level-02.webp" },
  { level: 3, maxAttempts: 15, title: "세계 방역 영웅", description: "탁월한 판단으로 지구의 감염을 끝낸 영웅", badge: "/assets/badges/hall-level-03.webp" },
  { level: 4, maxAttempts: 19, title: "대륙 정화 전략가", description: "대륙별 숫자 작전을 정교하게 완수한 전략가", badge: "/assets/badges/hall-level-04.webp" },
  { level: 5, maxAttempts: 24, title: "치료 세균 마스터", description: "치료 세균의 움직임을 자유롭게 다루는 전문가", badge: "/assets/badges/hall-level-05.webp" },
  { level: 6, maxAttempts: 30, title: "감염 역전 전문가", description: "위기를 분석해 끝내 감염을 뒤집은 해결사", badge: "/assets/badges/hall-level-06.webp" },
  { level: 7, maxAttempts: 38, title: "배수 전술 연구관", description: "배수 관계를 전술로 발전시킨 수학 연구관", badge: "/assets/badges/hall-level-07.webp" },
  { level: 8, maxAttempts: 48, title: "약수 탐사 대원", description: "약수의 단서를 끝까지 추적한 탐사 대원", badge: "/assets/badges/hall-level-08.webp" },
  { level: 9, maxAttempts: 60, title: "치료 세균 훈련관", description: "반복 훈련으로 모든 지역을 구한 방어대원", badge: "/assets/badges/hall-level-09.webp" },
  { level: 10, maxAttempts: Number.POSITIVE_INFINITY, title: "신입 방역 연구원", description: "포기하지 않고 지구 구출 임무를 완수한 연구원", badge: "/assets/badges/hall-level-10.webp" },
];

export function getHallTier(attempts: number) {
  return HALL_TIERS.find((tier) => attempts <= tier.maxAttempts) ?? HALL_TIERS[HALL_TIERS.length - 1];
}

export function hallTierRange(tier: HallTier) {
  const index = HALL_TIERS.findIndex((candidate) => candidate.level === tier.level);
  const minimum = index === 0 ? MIN_STORY_ATTEMPTS : HALL_TIERS[index - 1].maxAttempts + 1;
  return Number.isFinite(tier.maxAttempts) ? `${minimum}~${tier.maxAttempts}회` : `${minimum}회 이상`;
}
