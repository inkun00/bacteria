import {
  createBoard,
  getBoardSize,
  isRelation,
  legalMoves,
  randomRelatedNumber,
  randomSplitNumbers,
  type BoardSize,
  type Cell,
  type Move,
  type NumberCell,
  type Player,
  type RelationMode,
} from "./game";

export type StoryMode = RelationMode;

export type LearningTask = {
  id: string;
  prompt: string;
  context: string;
  options?: string[];
  answers: string[];
  multiple?: boolean;
  shortAnswer?: boolean;
  placeholder?: string;
  explanation: string;
};

export type StoryStage = {
  id: number;
  lesson: string;
  title: string;
  place: string;
  continent: string;
  x: number;
  y: number;
  story: string;
  mission: string;
  learning: string;
  example: string;
  modes: StoryMode[];
  playerNumbers: number[];
  enemyNumbers: number[];
  difficulty: 1 | 2 | 3;
  boss?: { hp: number; sequence: number[] };
};

export const MODE_COPY: Record<StoryMode, { label: string; short: string; explanation: string }> = {
  divisor: {
    label: "약수 모드",
    short: "약",
    explanation: "치료 세균의 수를 나누어떨어지게 하는 질병 세균을 감염시켜요.",
  },
  multiple: {
    label: "배수 모드",
    short: "배",
    explanation: "치료 세균 수의 배수인 질병 세균을 감염시켜요.",
  },
  split: {
    label: "분열 모드",
    short: "분",
    explanation: "합성수를 두 인수로 나누어 새 치료 세균을 만들어요.",
  },
};

export const STORY_STAGES: StoryStage[] = [
  {
    id: 1,
    lesson: "2차시 · 약수 이해하기",
    title: "사탕 창고 구조",
    place: "필리핀 · 마닐라",
    continent: "아시아",
    x: 76,
    y: 53,
    story: "보급 사탕이 감염됐다. 사탕을 남김없이 똑같이 나눌 수 있는 수만 치료 신호에 반응한다.",
    mission: "약수 모드만 사용해 약수 질병 세균을 모두 치료하세요.",
    learning: "나눗셈으로 어떤 수의 약수를 빠짐없이 찾습니다.",
    example: "6 ÷ 1, 2, 3, 6은 나머지가 0 → 1, 2, 3, 6은 6의 약수",
    modes: ["divisor"],
    playerNumbers: [6, 8, 12],
    enemyNumbers: [1, 2, 3, 4, 6, 8],
    difficulty: 1,
  },
  {
    id: 2,
    lesson: "3차시 · 배수 이해하기",
    title: "오세아니아 방벽",
    place: "호주 · 시드니",
    continent: "오세아니아",
    x: 84,
    y: 76,
    story: "질병 세균이 나무 도막처럼 일정한 묶음으로 증식한다. 곱셈 규칙을 역이용해 확산 고리를 끊자.",
    mission: "배수 모드만 사용해 배수 질병 세균을 모두 치료하세요.",
    learning: "어떤 수를 1배, 2배, 3배 한 수가 그 수의 배수임을 이해합니다.",
    example: "4 × 1, 2, 3, 4 → 4, 8, 12, 16은 4의 배수",
    modes: ["multiple"],
    playerNumbers: [2, 3, 4],
    enemyNumbers: [4, 6, 8, 9, 12, 16],
    difficulty: 1,
  },
  {
    id: 3,
    lesson: "4차시 · 공약수와 최대공약수",
    title: "나이로비 보급 분배",
    place: "케냐 · 나이로비",
    continent: "아프리카",
    x: 56,
    y: 62,
    story: "사과·귤 보급품을 같은 수의 봉지에 남김없이 나누어야 한다. 두 수에 공통인 약수를 찾아 구조대를 투입하자.",
    mission: "두 치료 수에 공통인 약수 세균을 우선 찾아 모두 치료하세요.",
    learning: "공약수와 가장 큰 공약수인 최대공약수의 관계를 익힙니다.",
    example: "12와 18의 공약수는 1, 2, 3, 6 → 최대공약수는 6",
    modes: ["divisor"],
    playerNumbers: [12, 18, 6],
    enemyNumbers: [1, 2, 3, 6, 2, 3, 6],
    difficulty: 2,
  },
  {
    id: 4,
    lesson: "5차시 · 최대공약수 구하기",
    title: "카이로 치료 화단",
    place: "이집트 · 카이로",
    continent: "아프리카",
    x: 53,
    y: 47,
    story: "장미와 튤립 치료 물질을 똑같은 꽃병에 나누어야 한다. 수를 인수로 분열해 가장 큰 공통 약수를 확보하자.",
    mission: "약수·분열 모드로 최대공약수 경로를 만들고 전부 치료하세요.",
    learning: "곱셈식과 공약수로 나누는 방법으로 최대공약수를 구합니다.",
    example: "12 = 3 × 4, 18 = 3 × 6 → 공통으로 나누며 최대공약수 6 발견",
    modes: ["divisor", "split"],
    playerNumbers: [12, 18, 24],
    enemyNumbers: [2, 3, 4, 6, 8, 9, 12],
    difficulty: 2,
  },
  {
    id: 5,
    lesson: "6차시 · 공배수와 최소공배수",
    title: "로마 생태 동기화",
    place: "이탈리아 · 로마",
    continent: "유럽",
    x: 51,
    y: 36,
    story: "서로 다른 주기로 물을 주는 치료 식물이 동시에 위험해졌다. 두 주기가 다시 만나는 공배수 지점을 찾아라.",
    mission: "배수 모드로 공배수 세균을 추적해 모두 치료하세요.",
    learning: "두 수의 공배수와 가장 작은 공배수의 관계를 익힙니다.",
    example: "3의 배수와 5의 배수가 처음 만나는 수는 15",
    modes: ["multiple"],
    playerNumbers: [3, 4, 5],
    enemyNumbers: [12, 15, 20, 24, 30, 40],
    difficulty: 2,
  },
  {
    id: 6,
    lesson: "7차시 · 최소공배수 구하기",
    title: "등대 동시 점등",
    place: "영국 · 런던",
    continent: "유럽",
    x: 46,
    y: 29,
    story: "감염 안개가 두 등대의 신호를 가렸다. 서로 다른 점등 주기가 처음 겹치는 순간에 치료 파장을 발사하자.",
    mission: "배수·분열 모드로 최소공배수 신호를 만들고 전부 치료하세요.",
    learning: "곱셈식과 공약수로 나누는 여러 방법으로 최소공배수를 구합니다.",
    example: "12와 20의 최소공배수는 60",
    modes: ["multiple", "split"],
    playerNumbers: [4, 6, 10],
    enemyNumbers: [12, 18, 20, 24, 30, 60, 40],
    difficulty: 2,
  },
  {
    id: 7,
    lesson: "8차시 · 약수와 배수 이어달리기",
    title: "아마존 릴레이",
    place: "브라질 · 리우",
    continent: "남아메리카",
    x: 31,
    y: 70,
    story: "아마존 감염망은 약수와 배수를 번갈아 연결한다. 치료 세균의 모드를 바꾸며 이어달리기처럼 경로를 이어라.",
    mission: "약수와 배수 모드를 번갈아 사용해 모든 감염 고리를 끊으세요.",
    learning: "약수와 배수의 관계를 빠르게 판단하고 전략에 적용합니다.",
    example: "3 → 12는 배수 관계, 12 → 4는 약수 관계",
    modes: ["divisor", "multiple"],
    playerNumbers: [6, 8, 9],
    enemyNumbers: [2, 3, 4, 12, 16, 18, 24, 27],
    difficulty: 3,
  },
  {
    id: 8,
    lesson: "9차시 · 생활 속 최소공배수",
    title: "대륙 횡단 열차",
    place: "미국 · 뉴욕",
    continent: "북아메리카",
    x: 24,
    y: 37,
    story: "12분 간격 열차와 18분 간격 열차가 감염된 선로에서 충돌하려 한다. 두 열차가 동시에 도착하는 주기를 찾아라.",
    mission: "배수 모드로 12와 18의 공배수 감염망을 제거하세요.",
    learning: "최소공배수로 실제 주기 문제를 해결하고 필요한 정보를 판단합니다.",
    example: "12와 18의 최소공배수 36 → 두 열차는 36분마다 동시에 도착",
    modes: ["multiple"],
    playerNumbers: [6, 12, 18],
    enemyNumbers: [24, 36, 48, 54, 72, 90, 108],
    difficulty: 3,
  },
  {
    id: 9,
    lesson: "10차시 · 배운 내용 확인",
    title: "북극권 최종 방어선",
    place: "캐나다 · 북극권",
    continent: "북아메리카",
    x: 18,
    y: 19,
    story: "지구 방어망의 마지막 관문이다. 약수, 배수, 최대공약수, 최소공배수 데이터를 모두 조합해 감염원을 추적하자.",
    mission: "모든 모드를 활용해 종합 감염군을 전부 치료하세요.",
    learning: "단원에서 배운 개념을 다양한 문제에 적용해 정리합니다.",
    example: "상황에 따라 약수·배수·공약수·공배수 관계를 선택",
    modes: ["divisor", "multiple", "split"],
    playerNumbers: [8, 12, 18],
    enemyNumbers: [2, 3, 4, 6, 16, 24, 36, 54, 72],
    difficulty: 3,
  },
  {
    id: 10,
    lesson: "보스 스테이지 · 2~10차시 복습",
    title: "원천균: 제로 프라임",
    place: "태평양 · 무인도",
    continent: "태평양",
    x: 92,
    y: 58,
    story: "모든 감염의 원천이 태평양 무인도에서 모습을 드러냈다. 수를 바꾸며 주변 세균을 되살리는 보스에게 연속 치료를 성공시켜라.",
    mission: "모든 모드로 보스를 5회 감염시키고 남은 질병 세균까지 제거하세요.",
    learning: "2~10차시의 약수와 배수 개념을 종합적으로 복습합니다.",
    example: "보스가 12 → 18 → 24 → 30 → 36으로 변이하므로 매번 관계를 다시 확인",
    modes: ["divisor", "multiple", "split"],
    playerNumbers: [6, 8, 12, 18],
    enemyNumbers: [2, 3, 4, 6, 12, 18, 24, 30],
    difficulty: 3,
    boss: { hp: 5, sequence: [12, 18, 24, 30, 36] },
  },
];

export const STAGE_LEARNING_TASKS: Record<number, LearningTask[]> = {
  1: [
    {
      id: "divisors-of-12",
      prompt: "12의 약수를 모두 선택하세요.",
      context: "12를 나누었을 때 나머지가 0인 수를 모두 찾아 치료 코어를 해제하세요.",
      options: ["1", "2", "3", "4", "5", "6", "8", "12"],
      answers: ["1", "2", "3", "4", "6", "12"],
      multiple: true,
      explanation: "12는 1, 2, 3, 4, 6, 12로 나누어떨어집니다. 따라서 이 수들이 12의 약수입니다.",
    },
    {
      id: "divisor-remainder",
      prompt: "5가 12의 약수가 아닌 까닭은 무엇일까요?",
      context: "약수인지 판단할 때 확인해야 하는 조건을 고르세요.",
      options: ["12 ÷ 5의 나머지가 0이 아니기 때문", "5가 12보다 작기 때문", "5가 홀수이기 때문"],
      answers: ["12 ÷ 5의 나머지가 0이 아니기 때문"],
      explanation: "어떤 수로 나누었을 때 나머지가 0이어야 그 수의 약수입니다.",
    },
    {
      id: "divisor-count-7",
      prompt: "7의 약수는 모두 몇 개일까요?",
      context: "7을 나누어떨어지게 하는 자연수를 빠짐없이 생각하세요.",
      answers: ["2", "2개"],
      shortAnswer: true,
      explanation: "7의 약수는 1과 7이므로 모두 2개입니다.",
    },
    {
      id: "missing-divisor-18",
      prompt: "18 ÷ □ = 3입니다. □에 들어갈 수를 쓰세요.",
      context: "나눗셈식을 이용해 18의 약수를 찾으세요.",
      answers: ["6"],
      shortAnswer: true,
      explanation: "18÷6=3이므로 □는 6이고, 6은 18의 약수입니다.",
    },
  ],
  2: [
    {
      id: "multiples-of-4",
      prompt: "4의 배수를 작은 수부터 6개 나열한 신호는?",
      context: "4에 1, 2, 3, …을 차례로 곱해 확인하세요.",
      options: ["4, 8, 12, 16, 20, 24", "1, 2, 4, 8, 12, 16", "4, 6, 8, 10, 12, 14"],
      answers: ["4, 8, 12, 16, 20, 24"],
      explanation: "4×1부터 4×6까지 계산하면 4, 8, 12, 16, 20, 24가 됩니다.",
    },
    {
      id: "factor-multiple-link",
      prompt: "4 × 6 = 24에서 옳은 관계를 고르세요.",
      context: "곱셈식은 약수와 배수의 관계를 함께 보여 줍니다.",
      options: ["4와 6은 24의 약수이고, 24는 4와 6의 배수", "24는 4의 약수", "6은 24의 배수"],
      answers: ["4와 6은 24의 약수이고, 24는 4와 6의 배수"],
      explanation: "곱해서 24를 만드는 4와 6은 24의 약수이고, 24는 두 수의 배수입니다.",
    },
    {
      id: "fifth-multiple-6",
      prompt: "6의 다섯 번째 배수를 쓰세요.",
      context: "6×1부터 차례로 세어 다섯 번째 값을 찾으세요.",
      answers: ["30"],
      shortAnswer: true,
      explanation: "6×5=30이므로 6의 다섯 번째 배수는 30입니다.",
    },
    {
      id: "multiple-product-8",
      prompt: "8의 일곱 번째 배수를 쓰세요.",
      context: "8에 7을 곱해 배수를 만드세요.",
      answers: ["56"],
      shortAnswer: true,
      explanation: "8×7=56이므로 56은 8의 일곱 번째 배수입니다.",
    },
  ],
  3: [
    {
      id: "common-divisors",
      prompt: "12와 18의 공약수를 모두 선택하세요.",
      context: "두 수를 모두 나누어떨어지게 하는 수만 선택해야 합니다.",
      options: ["1", "2", "3", "4", "6", "9", "12"],
      answers: ["1", "2", "3", "6"],
      multiple: true,
      explanation: "1, 2, 3, 6은 12와 18을 모두 나누어떨어지게 하므로 공약수입니다.",
    },
    {
      id: "greatest-common-divisor",
      prompt: "12와 18의 최대공약수는?",
      context: "앞에서 찾은 공약수 중 가장 큰 수를 선택하세요.",
      options: ["3", "6", "12", "18"],
      answers: ["6"],
      explanation: "공약수 1, 2, 3, 6 중 가장 큰 수는 6입니다.",
    },
    {
      id: "gcd-16-24",
      prompt: "16과 24의 최대공약수를 쓰세요.",
      context: "두 수의 공약수 중 가장 큰 수를 찾으세요.",
      answers: ["8"],
      shortAnswer: true,
      explanation: "16과 24의 공약수는 1, 2, 4, 8이고 최대공약수는 8입니다.",
    },
    {
      id: "common-divisor-count",
      prompt: "최대공약수가 6일 때, 두 수의 공약수는 모두 몇 개일까요?",
      context: "두 수의 공약수는 최대공약수의 약수와 같습니다.",
      answers: ["4", "4개"],
      shortAnswer: true,
      explanation: "6의 약수는 1, 2, 3, 6이므로 공약수는 모두 4개입니다.",
    },
  ],
  4: [
    {
      id: "gcd-division-path",
      prompt: "18과 24를 공약수로 계속 나눈 올바른 경로는?",
      context: "두 수를 같은 공약수로 나누는 과정을 추적하세요.",
      options: ["18, 24 ÷ 2 → 9, 12 ÷ 3 → 3, 4", "18, 24 ÷ 3 → 6, 7", "18, 24 ÷ 4 → 4, 6"],
      answers: ["18, 24 ÷ 2 → 9, 12 ÷ 3 → 3, 4"],
      explanation: "먼저 2로, 이어서 3으로 두 수를 함께 나눌 수 있습니다.",
    },
    {
      id: "gcd-product",
      prompt: "공통으로 나눈 2와 3을 이용한 최대공약수는?",
      context: "공통으로 나눈 수를 곱해 최대공약수를 완성하세요.",
      options: ["2", "3", "5", "6"],
      answers: ["6"],
      explanation: "공통으로 나눈 수 2와 3을 곱한 6이 18과 24의 최대공약수입니다.",
    },
    {
      id: "gcd-36-48",
      prompt: "36과 48의 최대공약수를 쓰세요.",
      context: "두 수를 공약수로 계속 나누거나 공약수를 비교하세요.",
      answers: ["12"],
      shortAnswer: true,
      explanation: "36과 48을 모두 나누는 가장 큰 수는 12입니다.",
    },
    {
      id: "gcd-flower-bags",
      prompt: "장미 24송이와 튤립 60송이를 남김없이 똑같이 나누어 최대한 많은 꽃병에 담으려 합니다. 꽃병은 몇 개 필요할까요?",
      context: "두 수의 최대공약수를 생활 문제에 적용하세요.",
      answers: ["12", "12개"],
      shortAnswer: true,
      explanation: "24와 60의 최대공약수는 12이므로 꽃병은 최대 12개입니다.",
    },
  ],
  5: [
    {
      id: "common-multiples",
      prompt: "50보다 작은 3과 5의 공배수를 모두 선택하세요.",
      context: "3의 배수이면서 동시에 5의 배수인 수를 찾으세요.",
      options: ["10", "15", "20", "30", "35", "45"],
      answers: ["15", "30", "45"],
      multiple: true,
      explanation: "15, 30, 45는 모두 3과 5로 나누어떨어지는 공배수입니다.",
    },
    {
      id: "least-common-multiple",
      prompt: "3과 5의 최소공배수는?",
      context: "공배수 중 가장 작은 수가 최소공배수입니다.",
      options: ["5", "10", "15", "30"],
      answers: ["15"],
      explanation: "공배수 15, 30, 45, … 중 가장 작은 수는 15입니다.",
    },
    {
      id: "lcm-4-6-concept",
      prompt: "4와 6의 최소공배수를 쓰세요.",
      context: "4의 배수와 6의 배수가 처음 만나는 수를 찾으세요.",
      answers: ["12"],
      shortAnswer: true,
      explanation: "4의 배수 4, 8, 12와 6의 배수 6, 12가 처음 만나는 수는 12입니다.",
    },
    {
      id: "first-common-multiple-2-3",
      prompt: "2와 3의 공배수 중 가장 작은 수를 쓰세요.",
      context: "두 수의 배수 목록을 비교하세요.",
      answers: ["6"],
      shortAnswer: true,
      explanation: "6은 2와 3의 첫 번째 공배수이므로 최소공배수입니다.",
    },
  ],
  6: [
    {
      id: "lcm-division-path",
      prompt: "12와 20의 최소공배수 계산식으로 알맞은 것은?",
      context: "공통 인수와 마지막에 남은 몫을 모두 한 번씩 곱하세요.",
      options: ["2 × 2 × 3 × 5 = 60", "2 × 2 = 4", "12 × 20 = 240"],
      answers: ["2 × 2 × 3 × 5 = 60"],
      explanation: "12와 20을 2, 2로 함께 나누고 남은 3과 5까지 곱하면 60입니다.",
    },
    {
      id: "lcm-check",
      prompt: "12와 20이 처음으로 다시 만나는 배수는?",
      context: "두 수의 최소공배수를 선택하세요.",
      options: ["40", "60", "80", "120"],
      answers: ["60"],
      explanation: "60은 12×5이면서 20×3이고, 가장 작은 공배수입니다.",
    },
    {
      id: "lcm-30-45",
      prompt: "30과 45의 최소공배수를 쓰세요.",
      context: "공약수로 나눈 수와 남은 몫을 모두 곱해 계산하세요.",
      answers: ["90"],
      shortAnswer: true,
      explanation: "30과 45의 최소공배수는 90입니다.",
    },
    {
      id: "lighthouse-cycle",
      prompt: "12초마다 켜지는 등대와 20초마다 켜지는 등대가 지금 함께 켜졌습니다. 다시 함께 켜지는 것은 몇 초 뒤일까요?",
      context: "두 점등 주기의 최소공배수를 구하세요.",
      answers: ["60", "60초"],
      shortAnswer: true,
      explanation: "12와 20의 최소공배수는 60이므로 60초 뒤에 다시 함께 켜집니다.",
    },
  ],
  7: [
    {
      id: "relay-options",
      prompt: "12 다음에 이어 쓸 수 있는 수를 모두 선택하세요.",
      context: "다음 수는 12의 약수이거나 12의 배수여야 합니다.",
      options: ["4", "5", "18", "24"],
      answers: ["4", "24"],
      multiple: true,
      explanation: "4는 12의 약수이고 24는 12의 배수이므로 둘 다 이어 쓸 수 있습니다.",
    },
    {
      id: "relay-chain",
      prompt: "중복 없이 완성된 이어달리기 경로는?",
      context: "앞 수와 다음 수가 매번 약수 또는 배수 관계인지 확인하세요.",
      options: ["3 → 12 → 4 → 20", "3 → 12 → 5 → 20", "3 → 12 → 3 → 9"],
      answers: ["3 → 12 → 4 → 20"],
      explanation: "3→12는 배수, 12→4는 약수, 4→20은 배수 관계이고 같은 수를 반복하지 않았습니다.",
    },
    {
      id: "relay-multiple-count",
      prompt: "이어달리기에서 4 다음에 20을 썼습니다. 20은 4의 몇 배일까요?",
      context: "앞 수와 다음 수의 배수 관계를 계산하세요.",
      answers: ["5", "5배"],
      shortAnswer: true,
      explanation: "4×5=20이므로 20은 4의 5배입니다.",
    },
    {
      id: "relay-next-prime",
      prompt: "7 다음에 이어 쓸 수 있는 7보다 큰 가장 작은 수를 쓰세요.",
      context: "7의 약수 또는 배수이면서 아직 사용하지 않은 수를 찾으세요.",
      answers: ["14"],
      shortAnswer: true,
      explanation: "7보다 큰 7의 가장 작은 배수는 14이므로 이어 쓸 수 있습니다.",
    },
  ],
  8: [
    {
      id: "train-information",
      prompt: "두 열차의 동시 도착 시간을 구할 때 꼭 필요한 정보는?",
      context: "문제를 풀기 위해 필요한 조건을 판단하세요.",
      options: ["각 열차의 운행 간격과 처음 함께 출발한 시간", "열차의 색과 좌석 수", "역 사이의 거리만"],
      answers: ["각 열차의 운행 간격과 처음 함께 출발한 시간"],
      explanation: "두 운행 간격의 최소공배수와 기준이 되는 출발 시간이 필요합니다.",
    },
    {
      id: "train-lcm",
      prompt: "12분과 18분 간격 열차가 7시에 함께 출발했습니다. 다시 만나는 때는?",
      context: "12와 18의 최소공배수를 시간표에 적용하세요.",
      options: ["7시 24분", "7시 30분", "7시 36분", "7시 48분"],
      answers: ["7시 36분"],
      explanation: "12와 18의 최소공배수는 36이므로 36분 뒤인 7시 36분에 다시 만납니다.",
    },
    {
      id: "bus-cycle-8-12",
      prompt: "8분마다 오는 버스와 12분마다 오는 버스가 지금 함께 도착했습니다. 다시 함께 도착하는 것은 몇 분 뒤일까요?",
      context: "두 운행 간격의 최소공배수를 구하세요.",
      answers: ["24", "24분"],
      shortAnswer: true,
      explanation: "8과 12의 최소공배수는 24이므로 24분 뒤에 다시 도착합니다.",
    },
    {
      id: "train-cycle-14-5",
      prompt: "14분 간격 열차와 5분 간격 열차가 함께 출발했습니다. 다시 함께 출발하는 것은 몇 분 뒤일까요?",
      context: "서로 공약수가 1인 두 수의 최소공배수를 구하세요.",
      answers: ["70", "70분"],
      shortAnswer: true,
      explanation: "14와 5의 최소공배수는 70이므로 70분 뒤에 다시 함께 출발합니다.",
    },
  ],
  9: [
    {
      id: "review-divisors",
      prompt: "12의 약수를 모두 선택하세요.",
      context: "약수 탐지 방어막을 해제하세요.",
      options: ["1", "2", "3", "4", "5", "6", "12"],
      answers: ["1", "2", "3", "4", "6", "12"],
      multiple: true,
      explanation: "12를 나누어떨어지게 하는 수는 1, 2, 3, 4, 6, 12입니다.",
    },
    {
      id: "review-gcd",
      prompt: "18과 24의 최대공약수는?",
      context: "공약수 중 가장 큰 수를 선택하세요.",
      options: ["3", "6", "9", "12"],
      answers: ["6"],
      explanation: "18과 24의 공약수 중 가장 큰 수는 6입니다.",
    },
    {
      id: "review-lcm",
      prompt: "14와 21의 최소공배수는?",
      context: "공배수 중 가장 작은 수를 선택하세요.",
      options: ["28", "35", "42", "84"],
      answers: ["42"],
      explanation: "42는 14×3이면서 21×2인 가장 작은 공배수입니다.",
    },
    {
      id: "review-life",
      prompt: "4일마다와 6일마다 하는 활동이 오늘 겹쳤습니다. 다시 겹치는 것은 며칠 뒤일까요?",
      context: "생활 속 주기 문제에 최소공배수를 적용하세요.",
      options: ["8일", "10일", "12일", "24일"],
      answers: ["12일"],
      explanation: "4와 6의 최소공배수는 12이므로 12일 뒤에 다시 겹칩니다.",
    },
    {
      id: "review-gcd-short",
      prompt: "40과 64의 최대공약수를 쓰세요.",
      context: "단원 확인 · 최대공약수 계산",
      answers: ["8"],
      shortAnswer: true,
      explanation: "40과 64를 모두 나누는 가장 큰 수는 8입니다.",
    },
    {
      id: "review-lcm-short",
      prompt: "16과 24의 최소공배수를 쓰세요.",
      context: "단원 확인 · 최소공배수 계산",
      answers: ["48"],
      shortAnswer: true,
      explanation: "48은 16×3이면서 24×2인 가장 작은 공배수입니다.",
    },
    {
      id: "review-sharing-short",
      prompt: "색종이 40장과 도화지 64장을 남김없이 똑같이 나누어 최대한 많은 꾸러미를 만들면 몇 꾸러미일까요?",
      context: "단원 확인 · 최대공약수 생활 문제",
      answers: ["8", "8꾸러미", "8개"],
      shortAnswer: true,
      explanation: "40과 64의 최대공약수가 8이므로 최대 8꾸러미를 만들 수 있습니다.",
    },
    {
      id: "review-cycle-short",
      prompt: "10일마다와 15일마다 하는 활동이 오늘 겹쳤습니다. 다시 겹치는 것은 며칠 뒤일까요?",
      context: "단원 확인 · 최소공배수 생활 문제",
      answers: ["30", "30일"],
      shortAnswer: true,
      explanation: "10과 15의 최소공배수는 30이므로 30일 뒤에 다시 겹칩니다.",
    },
  ],
  10: [
    {
      id: "boss-divisor",
      prompt: "보스 숫자 18의 약수를 모두 포착하세요.",
      context: "제1 내성 · 약수 신호",
      options: ["1", "2", "3", "4", "6", "9", "18"],
      answers: ["1", "2", "3", "6", "9", "18"],
      multiple: true,
      explanation: "18은 1, 2, 3, 6, 9, 18로 나누어떨어집니다.",
    },
    {
      id: "boss-multiple",
      prompt: "보스 숫자 6의 배수 신호만 모두 선택하세요.",
      context: "제2 내성 · 배수 신호",
      options: ["12", "18", "20", "24"],
      answers: ["12", "18", "24"],
      multiple: true,
      explanation: "12, 18, 24는 각각 6×2, 6×3, 6×4입니다.",
    },
    {
      id: "boss-gcd",
      prompt: "24와 36의 최대공약수는?",
      context: "제3 내성 · 최대공약수 신호",
      options: ["6", "8", "12", "18"],
      answers: ["12"],
      explanation: "24와 36을 모두 나누는 가장 큰 수는 12입니다.",
    },
    {
      id: "boss-lcm",
      prompt: "8과 12의 최소공배수는?",
      context: "제4 내성 · 최소공배수 신호",
      options: ["16", "20", "24", "48"],
      answers: ["24"],
      explanation: "24는 8×3이면서 12×2인 가장 작은 공배수입니다.",
    },
    {
      id: "boss-life",
      prompt: "15분과 20분 주기가 동시에 시작했습니다. 다시 겹치는 것은 몇 분 뒤일까요?",
      context: "최종 내성 · 생활 속 주기 신호",
      options: ["30분", "40분", "60분", "300분"],
      answers: ["60분"],
      explanation: "15와 20의 최소공배수는 60이므로 60분 뒤에 다시 겹칩니다.",
    },
    {
      id: "boss-divisor-count-short",
      prompt: "24의 약수는 모두 몇 개일까요?",
      context: "제6 내성 · 약수 완전 탐색",
      answers: ["8", "8개"],
      shortAnswer: true,
      explanation: "24의 약수는 1, 2, 3, 4, 6, 8, 12, 24로 모두 8개입니다.",
    },
    {
      id: "boss-multiple-short",
      prompt: "7의 다섯 번째 배수를 쓰세요.",
      context: "제7 내성 · 배수 생성",
      answers: ["35"],
      shortAnswer: true,
      explanation: "7×5=35이므로 7의 다섯 번째 배수는 35입니다.",
    },
    {
      id: "boss-gcd-short",
      prompt: "30과 45의 최대공약수를 쓰세요.",
      context: "제8 내성 · 최대공약수 계산",
      answers: ["15"],
      shortAnswer: true,
      explanation: "30과 45를 모두 나누는 가장 큰 수는 15입니다.",
    },
    {
      id: "boss-lcm-short",
      prompt: "18과 24의 최소공배수를 쓰세요.",
      context: "최종 내성 · 최소공배수 계산",
      answers: ["72"],
      shortAnswer: true,
      explanation: "72는 18×4이면서 24×3인 가장 작은 공배수입니다.",
    },
  ],
};

export function isLearningAnswerCorrect(task: LearningTask, selected: string[]) {
  if (task.shortAnswer) {
    const normalized = selected[0]?.trim().replace(/\s+/g, "").replace(/，/g, ",") ?? "";
    return task.answers.some((answer) => answer.trim().replace(/\s+/g, "").replace(/，/g, ",") === normalized);
  }
  if (selected.length !== task.answers.length) return false;
  const answerSet = new Set(task.answers);
  return selected.every((answer) => answerSet.has(answer));
}

export type StoryBattle = {
  board: Cell[];
  numbers: NumberCell[];
  bossIndex: number | null;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
};

const PLAYER_POSITIONS = [0, 48, 42, 6];
const ENEMY_POSITIONS = [16, 18, 24, 30, 32, 10, 38, 20, 28, 34];

export function createStoryBattle(stage: StoryStage, size: BoardSize = 7): StoryBattle {
  const board = createBoard(size).map(() => 0 as Cell);
  const numbers: NumberCell[] = board.map(() => null);

  stage.playerNumbers.forEach((value, index) => {
    const position = PLAYER_POSITIONS[index % PLAYER_POSITIONS.length];
    board[position] = 1;
    numbers[position] = value;
  });

  stage.enemyNumbers.forEach((value, index) => {
    const position = ENEMY_POSITIONS[index % ENEMY_POSITIONS.length];
    board[position] = 2;
    numbers[position] = value;
  });

  const bossIndex = stage.boss ? 24 : null;
  if (bossIndex !== null) {
    board[bossIndex] = 2;
    numbers[bossIndex] = stage.boss?.sequence[0] ?? 12;
  }

  return {
    board,
    numbers,
    bossIndex,
    bossHp: stage.boss?.hp ?? 0,
    bossMaxHp: stage.boss?.hp ?? 0,
    bossPhase: 0,
  };
}

export type StoryMoveResult = StoryBattle & {
  infected: number[];
  resisted: number[];
  relationText: string;
  bossHit: boolean;
};

function relationText(attacker: number, target: number, mode: StoryMode, success: boolean) {
  if (mode === "divisor") {
    return success
      ? `${attacker} ÷ ${target} = ${attacker / target} · 나누어떨어져 감염 성공!`
      : `${attacker}은(는) ${target}(으)로 나누어떨어지지 않아요.`;
  }
  if (mode === "multiple") {
    return success
      ? `${target} = ${attacker} × ${target / attacker} · 배수 관계로 감염 성공!`
      : `${target}은(는) ${attacker}의 배수가 아니에요.`;
  }
  return `${attacker}을(를) 두 인수로 분열해 치료 경로를 만들었어요.`;
}

export function applyStoryMove(
  battle: StoryBattle,
  stage: StoryStage,
  player: Player,
  move: Move,
  mode: StoryMode,
): StoryMoveResult {
  const board = [...battle.board];
  const numbers = [...battle.numbers];
  const sourceNumber = numbers[move.from] ?? 2;
  let attackNumber = sourceNumber;

  if (move.distance === 2) {
    board[move.from] = 0;
    numbers[move.from] = null;
    numbers[move.to] = sourceNumber;
  } else if (mode === "split") {
    const pair = randomSplitNumbers(sourceNumber);
    if (pair) {
      numbers[move.from] = pair[0];
      numbers[move.to] = pair[1];
      attackNumber = pair[1];
    } else {
      numbers[move.to] = sourceNumber;
    }
  } else {
    numbers[move.to] = randomRelatedNumber(sourceNumber, mode);
  }
  board[move.to] = player;

  const comparisonMode = mode === "split" ? "multiple" : mode;
  const infected: number[] = [];
  const resisted: number[] = [];
  let bossHit = false;
  let bossHp = battle.bossHp;
  let bossPhase = battle.bossPhase;
  const size = getBoardSize(board);
  const row = Math.floor(move.to / size);
  const col = move.to % size;
  let feedback = MODE_COPY[mode].explanation;

  for (let y = Math.max(0, row - 1); y <= Math.min(size - 1, row + 1); y += 1) {
    for (let x = Math.max(0, col - 1); x <= Math.min(size - 1, col + 1); x += 1) {
      const index = y * size + x;
      if (board[index] === 0 || board[index] === player) continue;
      const targetNumber = numbers[index] ?? 1;
      const success = isRelation(attackNumber, targetNumber, comparisonMode);
      feedback = relationText(attackNumber, targetNumber, comparisonMode, success);
      if (!success) {
        resisted.push(index);
        continue;
      }

      if (player === 1 && battle.bossIndex === index && stage.boss) {
        bossHit = true;
        bossHp = Math.max(0, bossHp - 1);
        bossPhase = (bossPhase + 1) % stage.boss.sequence.length;
        numbers[index] = stage.boss.sequence[bossPhase];
        if (bossHp === 0) {
          board[index] = 1;
          numbers[index] = attackNumber;
          infected.push(index);
        }
      } else {
        board[index] = player;
        numbers[index] = attackNumber;
        infected.push(index);
      }
    }
  }

  return {
    ...battle,
    board,
    numbers,
    bossHp,
    bossPhase,
    infected,
    resisted,
    relationText: bossHit && bossHp > 0
      ? `보스 치료 적중! 남은 내성 ${bossHp}/${battle.bossMaxHp} · 숫자가 ${numbers[battle.bossIndex ?? 0]}(으)로 변이했어요.`
      : feedback,
    bossHit,
  };
}

export function chooseStoryAiMove(battle: StoryBattle, stage: StoryStage): { move: Move; mode: StoryMode } | null {
  const moves = legalMoves(battle.board, 2);
  if (!moves.length) return null;
  const modes = stage.modes.filter((mode) => mode !== "split") as StoryMode[];
  const candidateModes: StoryMode[] = modes.length ? modes : ["divisor"];
  const scored = moves.flatMap((move) => candidateModes.map((mode) => {
    const preview = applyStoryMove(battle, stage, 2, move, mode);
    return { move, mode, value: preview.infected.length * 12 + (move.distance === 1 ? 3 : 0) + Math.random() * 2 };
  }));
  scored.sort((a, b) => b.value - a.value);
  const looseness = stage.difficulty === 1 ? Math.min(3, scored.length) : stage.difficulty === 2 ? Math.min(2, scored.length) : 1;
  return scored[Math.floor(Math.random() * looseness)] ?? null;
}

export type StoryRecovery = {
  battle: StoryBattle;
  sourceIndex: number;
  openedIndex: number;
  relationText: string;
};

function boardDistance(from: number, to: number, size: number) {
  const fromRow = Math.floor(from / size);
  const fromCol = from % size;
  const toRow = Math.floor(to / size);
  const toCol = to % size;
  return Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol));
}

export function applyEmergencyTreatment(battle: StoryBattle, stage: StoryStage): StoryRecovery | null {
  if (legalMoves(battle.board, 1).length || !battle.board.includes(1) || !battle.board.includes(2)) return null;

  const board = [...battle.board];
  const numbers = [...battle.numbers];
  const size = getBoardSize(board);
  const therapyCells = board.flatMap((cell, index) => cell === 1 ? [index] : []);
  const livingBossIndex = stage.boss && battle.bossHp > 0 ? battle.bossIndex : null;
  const removableDisease = board.flatMap((cell, index) => cell === 2 && index !== livingBossIndex ? [index] : []);

  if (removableDisease.length) {
    const target = removableDisease
      .map((index) => ({
        index,
        source: therapyCells.reduce((best, candidate) =>
          boardDistance(candidate, index, size) < boardDistance(best, index, size) ? candidate : best, therapyCells[0]),
      }))
      .sort((left, right) => boardDistance(left.source, left.index, size) - boardDistance(right.source, right.index, size))[0];
    board[target.index] = 0;
    numbers[target.index] = null;
    return {
      battle: { ...battle, board, numbers },
      sourceIndex: target.source,
      openedIndex: target.index,
      relationText: "이동 가능한 칸이 없어 연구소가 긴급 치료 파동을 발사했습니다. 가장 가까운 질병 세균 1개가 제거되어 작전을 계속할 수 있어요.",
    };
  }

  if (livingBossIndex !== null && therapyCells.length > 1) {
    const candidates = therapyCells
      .map((openedIndex) => ({
        openedIndex,
        sourceIndex: therapyCells.find((sourceIndex) => sourceIndex !== openedIndex && boardDistance(sourceIndex, openedIndex, size) <= 2),
      }))
      .filter((candidate): candidate is { openedIndex: number; sourceIndex: number } => candidate.sourceIndex !== undefined)
      .sort((left, right) => boardDistance(left.openedIndex, livingBossIndex, size) - boardDistance(right.openedIndex, livingBossIndex, size));
    const opening = candidates[0];
    if (opening) {
      board[opening.openedIndex] = 0;
      numbers[opening.openedIndex] = null;
      return {
        battle: { ...battle, board, numbers },
        sourceIndex: opening.sourceIndex,
        openedIndex: opening.openedIndex,
        relationText: "보스 공격 공간이 막혀 연구소가 치료 세균 1개를 회수했습니다. 열린 칸으로 이동해 보스 치료를 계속하세요.",
      };
    }
  }

  return null;
}

export function applyBossPulse(battle: StoryBattle, stage: StoryStage): StoryMoveResult {
  if (!stage.boss || battle.bossIndex === null || battle.bossHp <= 0) {
    return { ...battle, infected: [], resisted: [], relationText: "", bossHit: false };
  }
  const board = [...battle.board];
  const numbers = [...battle.numbers];
  const bossPhase = (battle.bossPhase + 1) % stage.boss.sequence.length;
  const bossNumber = stage.boss.sequence[bossPhase];
  numbers[battle.bossIndex] = bossNumber;
  const candidates = board
    .map((cell, index) => ({ cell, index, number: numbers[index] ?? 1 }))
    .filter(({ cell, number }) => cell === 1 && (isRelation(bossNumber, number, "divisor") || isRelation(bossNumber, number, "multiple")));
  const victim = candidates[Math.floor(Math.random() * candidates.length)];
  const infected: number[] = [];
  if (victim) {
    board[victim.index] = 2;
    numbers[victim.index] = bossNumber;
    infected.push(victim.index);
  }
  return {
    ...battle,
    board,
    numbers,
    bossPhase,
    infected,
    resisted: [],
    relationText: victim
      ? `보스가 ${bossNumber}(으)로 변이해 치료 세균 1개를 역감염시켰어요!`
      : `보스가 ${bossNumber}(으)로 변이했지만 역감염 대상은 없었어요.`,
    bossHit: false,
  };
}
