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
  crisis: string;
  story: string;
  mission: string;
  learning: string;
  example: string;
  modes: StoryMode[];
  playerNumbers: number[];
  enemyNumbers: number[];
  difficulty: 1 | 2 | 3;
  enemyMovement?: "any" | "jump-only";
  boss?: { hp: number; sequence: number[] };
};

export const MODE_COPY: Record<StoryMode, { label: string; short: string; explanation: string }> = {
  divisor: {
    label: "약수 모드",
    short: "약",
    explanation: "치료 세균의 수를 나누었을 때 나머지가 0이 되는 질병 세균을 치료해요.",
  },
  multiple: {
    label: "배수 모드",
    short: "배",
    explanation: "치료 세균 수의 배수인 질병 세균을 감염시켜요.",
  },
  split: {
    label: "분열 모드",
    short: "분",
    explanation: "한 수를 곱셈식의 두 수로 나누어 새 치료 세균을 만들어요.",
  },
};

export const STORY_STAGES: StoryStage[] = [
  {
    id: 1,
    lesson: "2차시 · 약수 이해하기",
    title: "사탕 창고 구하기",
    place: "필리핀 · 마닐라",
    continent: "아시아",
    x: 76,
    y: 53,
    crisis: "숫자 세균이 마닐라의 식량 창고와 구호 물품에 퍼졌습니다. 물품을 똑같이 나눌 수 없어 대피한 사람들에게 식량을 보내지 못하고 있습니다.",
    story: "구호용 사탕까지 감염되었습니다. 사탕을 남김없이 똑같이 나눌 수 있는 수를 찾으면 세균을 치료할 수 있습니다.",
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
    title: "시드니 항구 방어",
    place: "호주 · 시드니",
    continent: "오세아니아",
    x: 84,
    y: 76,
    crisis: "배수 규칙으로 늘어나는 세균이 시드니 항구의 짐 상자와 전기 장치에 차례로 퍼지고 있습니다. 늘어나는 순서를 알아내지 못하면 항구를 닫아야 합니다.",
    story: "질병 세균은 일정한 수만큼 계속 늘어납니다. 곱셈 규칙을 이용해 세균이 퍼지는 길을 끊어야 합니다.",
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
    title: "나이로비 식량 나누기",
    place: "케냐 · 나이로비",
    continent: "아프리카",
    x: 56,
    y: 62,
    crisis: "나이로비 구호 창고에 세균이 퍼졌습니다. 사과와 귤을 같은 수의 봉지에 나누지 못해 여러 대피소에 식량이 모자랍니다.",
    story: "사과와 귤을 같은 수의 봉지에 남김없이 나누어야 합니다. 두 수의 공통된 약수를 찾아 구조대를 보내세요.",
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
    crisis: "카이로 병원에서 쓰는 치료 꽃의 영양 물이 감염되었습니다. 장미와 튤립을 꽃병에 똑같이 나누지 못하면 치료약을 만들 수 없습니다.",
    story: "장미와 튤립을 같은 수의 꽃병에 똑같이 나누어야 합니다. 두 수를 곱셈식으로 나누어 가장 큰 공통 약수를 찾으세요.",
    mission: "약수·분열 모드로 최대공약수를 찾는 길을 만들고 모두 치료하세요.",
    learning: "곱셈식과 공약수로 나누는 방법으로 최대공약수를 구합니다.",
    example: "12 = 3 × 4, 18 = 3 × 6 → 두 수를 공통된 수로 나누어 최대공약수 6 찾기",
    modes: ["divisor", "split"],
    playerNumbers: [12, 18, 24],
    enemyNumbers: [2, 3, 4, 6, 8, 9, 12],
    difficulty: 2,
  },
  {
    id: 5,
    lesson: "6차시 · 공배수와 최소공배수",
    title: "로마 물 공급 시간 맞추기",
    place: "이탈리아 · 로마",
    continent: "유럽",
    x: 51,
    y: 36,
    crisis: "로마에서 물을 깨끗하게 만드는 곳과 농장에 물을 보내는 장치가 서로 다른 시간마다 감염되고 있습니다. 물 주는 시간을 맞추지 못해 식물과 마실 물이 모두 위험합니다.",
    story: "서로 다른 시간마다 물을 받는 치료 식물이 위험합니다. 두 시간이 다시 만나는 공배수를 찾으세요.",
    mission: "배수 모드로 공배수 세균을 찾아 모두 치료하세요.",
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
    title: "두 등대 함께 켜기",
    place: "영국 · 런던",
    continent: "유럽",
    x: 46,
    y: 29,
    crisis: "감염 안개가 영국과 프랑스 사이의 바다를 덮고 등대 불빛을 방해하고 있습니다. 두 등대가 함께 켜지는 때를 놓치면 구조선이 길을 찾지 못합니다.",
    story: "감염 안개가 두 등대의 불빛을 가렸습니다. 서로 다른 간격으로 켜지는 두 불빛이 처음 함께 켜질 때 치료 빛을 보내세요.",
    mission: "배수·분열 모드로 최소공배수를 찾고 모두 치료하세요.",
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
    title: "아마존 이어달리기",
    place: "브라질 · 리우",
    continent: "남아메리카",
    x: 31,
    y: 70,
    crisis: "아마존강의 물을 깨끗하게 만드는 곳들이 약수와 배수 관계로 이어진 세균에 감염되었습니다. 세균의 연결을 끊지 않으면 더러운 물이 강 주변 마을로 계속 퍼집니다.",
    story: "아마존의 세균은 약수와 배수 관계로 번갈아 이어져 있습니다. 치료 세균의 모드를 바꾸며 이어달리기처럼 길을 이어 가세요.",
    mission: "약수와 배수 모드를 번갈아 사용해 이어진 세균을 모두 치료하세요.",
    learning: "약수와 배수의 관계를 빠르게 알아보고 게임에 이용합니다.",
    example: "3 → 12는 배수 관계, 12 → 4는 약수 관계",
    modes: ["divisor", "multiple"],
    playerNumbers: [6, 8, 9],
    enemyNumbers: [2, 3, 4, 12, 16, 18],
    difficulty: 1,
    enemyMovement: "jump-only",
  },
  {
    id: 8,
    lesson: "9차시 · 생활 속 최소공배수",
    title: "뉴욕 열차 구하기",
    place: "미국 · 뉴욕",
    continent: "북아메리카",
    x: 24,
    y: 37,
    crisis: "뉴욕의 열차 신호에 세균이 퍼져 서로 다른 간격으로 다니는 열차들이 같은 선로에 들어오고 있습니다. 열차 운행이 멈췄고, 두 열차가 함께 도착하면 부딪칠 수도 있습니다.",
    story: "12분마다 오는 열차와 18분마다 오는 열차가 같은 선로에서 부딪치려 합니다. 두 열차가 함께 도착하는 시간을 찾으세요.",
    mission: "배수 모드로 12와 18의 공배수 세균을 모두 치료하세요.",
    learning: "최소공배수로 생활 속 반복되는 시간 문제를 해결하고 필요한 내용을 찾습니다.",
    example: "12와 18의 최소공배수 36 → 두 열차는 36분마다 동시에 도착",
    modes: ["multiple"],
    playerNumbers: [6, 12, 18],
    enemyNumbers: [24, 36, 48, 54, 72, 90, 108],
    difficulty: 3,
  },
  {
    id: 9,
    lesson: "10차시 · 배운 내용 확인",
    title: "북극 마지막 방어 기지",
    place: "캐나다 · 북극권",
    continent: "북아메리카",
    x: 18,
    y: 19,
    crisis: "북극의 마지막 지구 방어 기지가 여러 숫자 규칙을 쓰는 세균에게 둘러싸였습니다. 연락과 물품을 보내는 길이 끊겨 다른 대륙에 치료 방법을 알려 줄 수 없습니다.",
    story: "지구를 지키는 마지막 단계입니다. 약수, 배수, 최대공약수, 최소공배수를 모두 이용해 세균이 시작된 곳을 찾으세요.",
    mission: "모든 모드를 사용해 여러 종류의 질병 세균을 전부 치료하세요.",
    learning: "이 단원에서 배운 내용을 여러 문제에 사용하며 정리합니다.",
    example: "상황에 따라 약수·배수·공약수·공배수 관계를 선택",
    modes: ["divisor", "multiple", "split"],
    playerNumbers: [8, 12, 18],
    enemyNumbers: [2, 3, 4, 6, 16, 24, 36, 54, 72],
    difficulty: 2,
    enemyMovement: "jump-only",
  },
  {
    id: 10,
    lesson: "보스 스테이지 · 2~10차시 복습",
    title: "우두머리 세균: 제로 프라임",
    place: "태평양 · 무인도",
    continent: "태평양",
    x: 92,
    y: 58,
    crisis: "태평양 무인도의 우두머리 세균이 계속 숫자를 바꾸며 전 세계에 세균을 다시 퍼뜨리고 있습니다. 지금 없애지 못하면 이미 구한 지역도 다시 감염됩니다.",
    story: "모든 감염을 시작한 우두머리 세균이 태평양 무인도에 나타났습니다. 보스는 두 턴마다 한 칸씩 복제 이동하며 질병 세균을 늘립니다. 숫자 관계를 살펴 여러 번 치료하세요.",
    mission: "두 턴마다 복제 이동하는 보스를 모든 모드로 5번 치료하고 남은 질병 세균도 모두 없애세요.",
    learning: "2~10차시에 배운 약수와 배수 내용을 모두 다시 확인합니다.",
    example: "보스는 12 → 18 → 24 → 30 → 36으로 수를 바꾸고, 두 턴마다 인접한 칸으로 복제 이동",
    modes: ["divisor", "multiple", "split"],
    playerNumbers: [6, 8, 12, 18],
    enemyNumbers: [2, 3, 4, 6, 12, 18],
    difficulty: 1,
    enemyMovement: "jump-only",
    boss: { hp: 5, sequence: [12, 18, 24, 30, 36] },
  },
];

export const STAGE_LEARNING_TASKS: Record<number, LearningTask[]> = {
  1: [
    {
      id: "divisors-of-20",
      prompt: "20의 약수를 모두 고르세요.",
      context: "20을 나누었을 때 나누어떨어지는 수를 빠짐없이 찾아보세요.",
      options: ["1", "2", "4", "5", "8", "10", "20"],
      answers: ["1", "2", "4", "5", "10", "20"],
      multiple: true,
      explanation: "20은 1, 2, 4, 5, 10, 20으로 나누어떨어지므로 이 수들이 20의 약수입니다.",
    },
    {
      id: "number-from-divisors",
      prompt: "약수가 1, 2, 7, 14인 수는 어느 것인가요?",
      context: "어떤 수의 약수를 모두 나타낸 것을 보고 원래 수를 찾아보세요.",
      options: ["7", "12", "14", "28"],
      answers: ["14"],
      explanation: "14를 나누어떨어지게 하는 수는 1, 2, 7, 14이므로 정답은 14입니다.",
    },
    {
      id: "divisor-pairs",
      prompt: "왼쪽 수가 오른쪽 수의 약수인 것을 모두 고르세요.",
      context: "두 수를 나누어 나머지가 0인지 확인하세요.",
      options: ["6과 42", "8과 30", "9와 54", "12와 50"],
      answers: ["6과 42", "9와 54"],
      multiple: true,
      explanation: "42÷6=7, 54÷9=6으로 나누어떨어집니다. 8은 30의 약수가 아니고 12는 50의 약수가 아닙니다.",
    },
    {
      id: "orange-bag-count",
      prompt: "귤 28개를 여러 봉지에 남김없이 똑같이 나누어 담는 방법은 모두 몇 가지인가요?",
      context: "봉지 수가 될 수 있는 28의 약수를 모두 찾아 개수를 세어 보세요.",
      answers: ["6", "6가지"],
      shortAnswer: true,
      explanation: "28의 약수는 1, 2, 4, 7, 14, 28이므로 나누어 담는 방법은 6가지입니다.",
    },
  ],
  2: [
    {
      id: "multiples-of-9",
      prompt: "9의 배수를 가장 작은 수부터 차례로 5개 쓴 것은 어느 것인가요?",
      context: "9에 1, 2, 3, 4, 5를 차례로 곱해 보세요.",
      options: ["9, 18, 27, 36, 45", "9, 17, 25, 33, 41", "1, 3, 9, 18, 27"],
      answers: ["9, 18, 27, 36, 45"],
      explanation: "9×1부터 9×5까지 계산하면 9, 18, 27, 36, 45입니다.",
    },
    {
      id: "multiples-of-12",
      prompt: "다음 수 중 12의 배수를 모두 고르세요.",
      context: "각 수가 12×자연수로 나타내어지는지 확인하세요.",
      options: ["24", "36", "50", "60", "84", "98"],
      answers: ["24", "36", "60", "84"],
      multiple: true,
      explanation: "24=12×2, 36=12×3, 60=12×5, 84=12×7이므로 12의 배수입니다.",
    },
    {
      id: "largest-two-digit-multiple",
      prompt: "14의 배수 중 가장 큰 두 자리 수를 쓰세요.",
      context: "14의 배수를 차례로 구해 100보다 작은 마지막 수를 찾으세요.",
      answers: ["98"],
      shortAnswer: true,
      explanation: "14×7=98이고 14×8=112이므로 가장 큰 두 자리 배수는 98입니다.",
    },
    {
      id: "bus-fifth-departure",
      prompt: "버스가 오전 9시부터 18분 간격으로 출발합니다. 5번째 버스는 몇 시 몇 분에 출발하나요?",
      context: "첫 버스가 오전 9시에 출발하므로 18분을 네 번 더해 보세요.",
      answers: ["오전10시12분", "10시12분"],
      shortAnswer: true,
      explanation: "5번째 버스는 처음 출발한 뒤 18×4=72분 후이므로 오전 10시 12분에 출발합니다.",
    },
  ],
  3: [
    {
      id: "common-divisors",
      prompt: "18과 30의 공약수를 모두 고르세요.",
      context: "두 수를 모두 나누어떨어지게 하는 수만 선택해야 합니다.",
      options: ["1", "2", "3", "5", "6", "9", "10", "15"],
      answers: ["1", "2", "3", "6"],
      multiple: true,
      explanation: "18과 30을 모두 나누어떨어지게 하는 수는 1, 2, 3, 6입니다.",
    },
    {
      id: "greatest-common-divisor",
      prompt: "18과 30의 최대공약수는 어느 것인가요?",
      context: "앞에서 찾은 공약수 중 가장 큰 수를 선택하세요.",
      options: ["2", "3", "6", "9"],
      answers: ["6"],
      explanation: "18과 30의 공약수 1, 2, 3, 6 중 가장 큰 수는 6입니다.",
    },
    {
      id: "common-divisors-from-gcd",
      prompt: "어떤 두 수의 최대공약수가 24입니다. 두 수의 공약수가 될 수 있는 수를 모두 고르세요.",
      context: "두 수의 공약수는 최대공약수 24의 약수와 같습니다.",
      options: ["3", "4", "6", "8", "10", "12"],
      answers: ["3", "4", "6", "8", "12"],
      multiple: true,
      explanation: "3, 4, 6, 8, 12는 모두 24의 약수이므로 두 수의 공약수가 될 수 있습니다.",
    },
    {
      id: "common-divisor-count",
      prompt: "42와 56의 공약수는 모두 몇 개인가요?",
      context: "두 수의 최대공약수를 구한 뒤 그 수의 약수 개수를 세어 보세요.",
      answers: ["4", "4개"],
      shortAnswer: true,
      explanation: "42와 56의 최대공약수는 14이고, 14의 약수는 1, 2, 7, 14이므로 공약수는 4개입니다.",
    },
  ],
  4: [
    {
      id: "gcd-factorization",
      prompt: "40=2×2×2×5, 60=2×2×3×5일 때 최대공약수를 구하는 식은 어느 것인가요?",
      context: "두 곱셈식에 공통으로 들어 있는 수를 한 번씩 곱하세요.",
      options: ["2×2×5=20", "2×2×2×3×5=120", "2×5=10"],
      answers: ["2×2×5=20"],
      explanation: "두 수에 공통으로 들어 있는 2, 2, 5를 곱하면 최대공약수는 20입니다.",
    },
    {
      id: "gcd-division-path",
      prompt: "42와 63을 공약수로 계속 나눈 올바른 과정은 어느 것인가요?",
      context: "두 수를 같은 수로 나누어 몫이 서로소가 될 때까지 계산하세요.",
      options: ["42, 63 ÷ 3 → 14, 21 ÷ 7 → 2, 3", "42, 63 ÷ 6 → 7, 10", "42, 63 ÷ 9 → 4, 7"],
      answers: ["42, 63 ÷ 3 → 14, 21 ÷ 7 → 2, 3"],
      explanation: "42와 63은 3으로 나눈 뒤 다시 7로 함께 나눌 수 있으므로 최대공약수는 3×7=21입니다.",
    },
    {
      id: "gcd-72-90",
      prompt: "72와 90의 최대공약수를 쓰세요.",
      context: "두 수를 공약수로 계속 나누거나 공약수를 비교하세요.",
      answers: ["18"],
      shortAnswer: true,
      explanation: "72와 90을 모두 나누어떨어지게 하는 가장 큰 수는 18입니다.",
    },
    {
      id: "gcd-sharing-students",
      prompt: "떡 48개와 주스 60개를 최대한 많은 학생에게 남김없이 똑같이 나누어 주려고 합니다. 최대 몇 명에게 줄 수 있나요?",
      context: "두 수의 최대공약수를 생활 문제에 이용하세요.",
      answers: ["12", "12명"],
      shortAnswer: true,
      explanation: "48과 60의 최대공약수는 12이므로 최대 12명에게 나누어 줄 수 있습니다.",
    },
  ],
  5: [
    {
      id: "common-multiples",
      prompt: "100보다 작은 8과 12의 공배수를 모두 고르세요.",
      context: "8의 배수이면서 동시에 12의 배수인 수를 찾으세요.",
      options: ["16", "24", "36", "48", "72", "84", "96"],
      answers: ["24", "48", "72", "96"],
      multiple: true,
      explanation: "8과 12의 공배수는 24의 배수이므로 100보다 작은 수는 24, 48, 72, 96입니다.",
    },
    {
      id: "least-common-multiple",
      prompt: "8과 12의 최소공배수는 어느 것인가요?",
      context: "공배수 중 가장 작은 수가 최소공배수입니다.",
      options: ["12", "16", "24", "48"],
      answers: ["24"],
      explanation: "8과 12의 공배수 24, 48, 72, … 중 가장 작은 수는 24입니다.",
    },
    {
      id: "common-multiples-from-lcm",
      prompt: "어떤 두 수의 최소공배수가 18입니다. 두 수의 공배수를 모두 고르세요.",
      context: "두 수의 공배수는 최소공배수 18의 배수입니다.",
      options: ["18", "36", "45", "54", "72"],
      answers: ["18", "36", "54", "72"],
      multiple: true,
      explanation: "18, 36, 54, 72는 18의 배수이므로 두 수의 공배수입니다. 45는 18의 배수가 아닙니다.",
    },
    {
      id: "two-digit-common-multiple-count",
      prompt: "6과 8의 공배수 중 두 자리 수는 모두 몇 개인가요?",
      context: "6과 8의 최소공배수부터 두 자리 공배수를 차례로 써 보세요.",
      answers: ["4", "4개"],
      shortAnswer: true,
      explanation: "최소공배수는 24이고 두 자리 공배수는 24, 48, 72, 96이므로 4개입니다.",
    },
  ],
  6: [
    {
      id: "lcm-division-path",
      prompt: "18과 30의 최소공배수 계산식으로 알맞은 것은 어느 것인가요?",
      context: "두 수를 함께 나눈 수와 마지막에 남은 수를 모두 한 번씩 곱하세요.",
      options: ["2×3×3×5=90", "2×3=6", "18×30=540"],
      answers: ["2×3×3×5=90"],
      explanation: "18과 30을 2, 3으로 함께 나누고 남은 3과 5까지 곱하면 최소공배수는 90입니다.",
    },
    {
      id: "lcm-24-36",
      prompt: "24와 36의 최소공배수를 쓰세요.",
      context: "두 수를 공약수로 계속 나눈 수와 마지막 몫을 모두 곱하세요.",
      answers: ["72"],
      shortAnswer: true,
      explanation: "72는 24×3이면서 36×2인 가장 작은 공배수입니다.",
    },
    {
      id: "smallest-square-side",
      prompt: "가로 12cm, 세로 18cm인 직사각형 종이를 겹치지 않게 이어 붙여 가장 작은 정사각형을 만들려고 합니다. 정사각형의 한 변은 몇 cm인가요?",
      context: "12와 18의 공배수 중 가장 작은 수를 구하세요.",
      answers: ["36", "36cm"],
      shortAnswer: true,
      explanation: "12와 18의 최소공배수는 36이므로 가장 작은 정사각형의 한 변은 36cm입니다.",
    },
    {
      id: "lighthouse-cycle",
      prompt: "16초마다 켜지는 등대와 24초마다 켜지는 등대가 지금 함께 켜졌습니다. 다시 함께 켜지는 것은 몇 초 뒤인가요?",
      context: "두 등대 불빛이 켜지는 간격의 최소공배수를 구하세요.",
      answers: ["48", "48초"],
      shortAnswer: true,
      explanation: "16과 24의 최소공배수는 48이므로 48초 뒤에 다시 함께 켜집니다.",
    },
  ],
  7: [
    {
      id: "factor-multiple-pairs",
      prompt: "두 수가 서로 약수와 배수의 관계인 것을 모두 고르세요.",
      context: "큰 수가 작은 수로 나누어떨어지는지 확인하세요.",
      options: ["6과 24", "8과 30", "9와 45", "14와 42"],
      answers: ["6과 24", "9와 45", "14와 42"],
      multiple: true,
      explanation: "24=6×4, 45=9×5, 42=14×3이므로 세 쌍은 약수와 배수의 관계입니다.",
    },
    {
      id: "factor-multiple-statements",
      prompt: "7×8=56을 보고 옳게 설명한 것을 모두 고르세요.",
      context: "곱셈식에서 곱하는 수는 곱의 약수이고, 곱은 두 수의 배수입니다.",
      options: ["7과 8은 56의 약수", "56은 7과 8의 배수", "56은 7의 약수", "8은 56의 배수"],
      answers: ["7과 8은 56의 약수", "56은 7과 8의 배수"],
      multiple: true,
      explanation: "7×8=56이므로 7과 8은 56의 약수이고 56은 7과 8의 배수입니다.",
    },
    {
      id: "multiples-below-100",
      prompt: "100보다 작은 수 중에서 16의 배수는 모두 몇 개인가요?",
      context: "16의 배수를 가장 작은 수부터 100보다 작을 때까지 써 보세요.",
      answers: ["6", "6개"],
      shortAnswer: true,
      explanation: "16, 32, 48, 64, 80, 96으로 모두 6개입니다.",
    },
    {
      id: "bounded-divisor",
      prompt: "어떤 수는 72의 약수이면서 16보다 크고 20보다 작습니다. 어떤 수인지 쓰세요.",
      context: "72의 약수를 구한 뒤 주어진 범위에 있는 수를 찾으세요.",
      answers: ["18"],
      shortAnswer: true,
      explanation: "72의 약수 중 16보다 크고 20보다 작은 수는 18입니다.",
    },
  ],
  8: [
    {
      id: "train-departure-time",
      prompt: "12분 간격 열차와 18분 간격 열차가 오전 7시에 함께 출발했습니다. 다음에 함께 출발하는 시각은 언제인가요?",
      context: "12와 18의 최소공배수를 구해 오전 7시에 더하세요.",
      options: ["오전 7시 24분", "오전 7시 30분", "오전 7시 36분", "오전 7시 48분"],
      answers: ["오전 7시 36분"],
      explanation: "12와 18의 최소공배수는 36이므로 오전 7시 36분에 다시 함께 출발합니다.",
    },
    {
      id: "traffic-light-cycle",
      prompt: "한 신호등은 15초마다, 다른 신호등은 20초마다 켜집니다. 지금 함께 켜졌다면 몇 초 뒤에 다시 함께 켜지나요?",
      context: "15와 20의 최소공배수를 구하세요.",
      answers: ["60", "60초"],
      shortAnswer: true,
      explanation: "15와 20의 최소공배수는 60이므로 60초 뒤에 다시 함께 켜집니다.",
    },
    {
      id: "colored-dot-spacing",
      prompt: "같은 점에서 시작해 검은 점은 8cm 간격, 빨간 점은 12cm 간격으로 찍습니다. 두 색 점은 몇 cm마다 함께 찍히나요?",
      context: "8과 12의 최소공배수를 구하세요.",
      answers: ["24", "24cm"],
      shortAnswer: true,
      explanation: "8과 12의 최소공배수는 24이므로 두 색 점은 24cm마다 함께 찍힙니다.",
    },
    {
      id: "two-train-time",
      prompt: "24분 간격 열차와 30분 간격 열차가 오후 2시에 함께 출발했습니다. 다음에 함께 출발하는 시각을 쓰세요.",
      context: "24와 30의 최소공배수를 구해 오후 2시에 더하세요.",
      answers: ["오후4시", "4시", "오후4시0분"],
      shortAnswer: true,
      explanation: "24와 30의 최소공배수는 120분이므로 2시간 뒤인 오후 4시에 다시 함께 출발합니다.",
    },
  ],
  9: [
    {
      id: "review-divisors",
      prompt: "36의 약수를 모두 고르세요.",
      context: "36을 나누어떨어지게 하는 수를 빠짐없이 찾으세요.",
      options: ["1", "2", "3", "4", "6", "8", "9", "12", "18", "36"],
      answers: ["1", "2", "3", "4", "6", "9", "12", "18", "36"],
      multiple: true,
      explanation: "36의 약수는 1, 2, 3, 4, 6, 9, 12, 18, 36입니다.",
    },
    {
      id: "review-fewest-divisors",
      prompt: "약수가 가장 적은 수는 어느 것인가요?",
      context: "각 수의 약수 개수를 비교하세요.",
      options: ["13", "18", "25", "32"],
      answers: ["13"],
      explanation: "13의 약수는 1과 13뿐이므로 네 수 중 약수가 가장 적습니다.",
    },
    {
      id: "review-multiple-count",
      prompt: "70보다 작은 수 중에서 11의 배수는 모두 몇 개인가요?",
      context: "11의 배수를 가장 작은 수부터 70보다 작을 때까지 써 보세요.",
      answers: ["6", "6개"],
      shortAnswer: true,
      explanation: "11, 22, 33, 44, 55, 66으로 모두 6개입니다.",
    },
    {
      id: "review-factor-multiple-pairs",
      prompt: "두 수가 약수와 배수의 관계인 것을 모두 고르세요.",
      context: "큰 수가 작은 수로 나누어떨어지는지 확인하세요.",
      options: ["5와 35", "12와 50", "18과 54", "24와 36"],
      answers: ["5와 35", "18과 54"],
      multiple: true,
      explanation: "35=5×7, 54=18×3이므로 두 쌍이 약수와 배수의 관계입니다.",
    },
    {
      id: "review-gcd-short",
      prompt: "48과 72의 최대공약수를 쓰세요.",
      context: "단원 확인 · 최대공약수 계산",
      answers: ["24"],
      shortAnswer: true,
      explanation: "48과 72를 모두 나누는 가장 큰 수는 24입니다.",
    },
    {
      id: "review-sharing-short",
      prompt: "쿠키 54개와 사탕 72개를 최대한 많은 학생에게 남김없이 똑같이 나누어 주려고 합니다. 최대 몇 명에게 줄 수 있나요?",
      context: "단원 확인 · 최대공약수 생활 문제",
      answers: ["18", "18명"],
      shortAnswer: true,
      explanation: "54와 72의 최대공약수는 18이므로 최대 18명에게 나누어 줄 수 있습니다.",
    },
    {
      id: "review-lcm-short",
      prompt: "14와 20의 최소공배수를 쓰세요.",
      context: "단원 확인 · 최소공배수 계산",
      answers: ["140"],
      shortAnswer: true,
      explanation: "140은 14×10이면서 20×7인 가장 작은 공배수입니다.",
    },
    {
      id: "review-cycle-short",
      prompt: "8일마다와 12일마다 하는 활동이 오늘 겹쳤습니다. 다시 겹치는 것은 며칠 뒤인가요?",
      context: "단원 확인 · 최소공배수 생활 문제",
      answers: ["24", "24일"],
      shortAnswer: true,
      explanation: "8과 12의 최소공배수는 24이므로 24일 뒤에 다시 겹칩니다.",
    },
  ],
  10: [
    {
      id: "boss-divisor",
      prompt: "42의 약수를 모두 고르세요.",
      context: "첫 번째 보스 문제 · 약수",
      options: ["1", "2", "3", "6", "7", "12", "14", "21", "42"],
      answers: ["1", "2", "3", "6", "7", "14", "21", "42"],
      multiple: true,
      explanation: "42의 약수는 1, 2, 3, 6, 7, 14, 21, 42입니다.",
    },
    {
      id: "boss-multiple",
      prompt: "45의 약수가 아닌 것은 어느 것인가요?",
      context: "두 번째 보스 문제 · 약수 판별",
      options: ["1", "3", "5", "9", "15", "20", "45"],
      answers: ["20"],
      explanation: "45는 20으로 나누어떨어지지 않으므로 20은 45의 약수가 아닙니다.",
    },
    {
      id: "boss-multiple-selection",
      prompt: "다음 수 중 9의 배수를 모두 고르세요.",
      context: "세 번째 보스 문제 · 배수 판별",
      options: ["18", "27", "40", "54", "72", "81", "100"],
      answers: ["18", "27", "54", "72", "81"],
      multiple: true,
      explanation: "18, 27, 54, 72, 81은 각각 9에 자연수를 곱해 만들 수 있습니다.",
    },
    {
      id: "boss-relation-statements",
      prompt: "6×8=48을 보고 옳게 설명한 것을 모두 고르세요.",
      context: "네 번째 보스 문제 · 약수와 배수의 관계",
      options: ["6과 8은 48의 약수", "48은 6과 8의 배수", "48은 6의 약수", "8은 48의 배수"],
      answers: ["6과 8은 48의 약수", "48은 6과 8의 배수"],
      multiple: true,
      explanation: "6×8=48이므로 6과 8은 48의 약수이고, 48은 두 수의 배수입니다.",
    },
    {
      id: "boss-common-divisors",
      prompt: "24와 40의 공약수를 모두 고르세요.",
      context: "다섯 번째 보스 문제 · 공약수",
      options: ["1", "2", "3", "4", "5", "8", "10", "12"],
      answers: ["1", "2", "4", "8"],
      multiple: true,
      explanation: "24와 40을 모두 나누어떨어지게 하는 수는 1, 2, 4, 8입니다.",
    },
    {
      id: "boss-gcd-short",
      prompt: "84와 126의 최대공약수를 쓰세요.",
      context: "여섯 번째 보스 문제 · 최대공약수 계산",
      answers: ["42"],
      shortAnswer: true,
      explanation: "84와 126을 모두 나누어떨어지게 하는 가장 큰 수는 42입니다.",
    },
    {
      id: "boss-lcm-short",
      prompt: "15와 18의 최소공배수를 쓰세요.",
      context: "일곱 번째 보스 문제 · 최소공배수 계산",
      answers: ["90"],
      shortAnswer: true,
      explanation: "90은 15×6이면서 18×5인 가장 작은 공배수입니다.",
    },
    {
      id: "boss-square-short",
      prompt: "가로 20cm, 세로 30cm인 직사각형 종이를 이어 붙여 가장 작은 정사각형을 만들 때 한 변은 몇 cm인가요?",
      context: "여덟 번째 보스 문제 · 최소공배수 생활 문제",
      answers: ["60", "60cm"],
      shortAnswer: true,
      explanation: "20과 30의 최소공배수는 60이므로 정사각형의 한 변은 60cm입니다.",
    },
    {
      id: "boss-cycle-short",
      prompt: "기계 ㉮는 18일마다, 기계 ㉯는 24일마다 점검합니다. 오늘 함께 점검했다면 다음에 함께 점검하는 것은 며칠 뒤인가요?",
      context: "마지막 보스 문제 · 최소공배수 생활 문제",
      answers: ["72", "72일"],
      shortAnswer: true,
      explanation: "18과 24의 최소공배수는 72이므로 72일 뒤에 다시 함께 점검합니다.",
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
  bossTurn: number;
};

export type StoryBattleOutcome = "clear" | "failed" | null;

export function getStoryBattleOutcome(battle: StoryBattle): StoryBattleOutcome {
  if (!battle.board.includes(2)) return "clear";
  if (!battle.board.includes(1) || !battle.board.includes(0)) return "failed";
  return null;
}

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
    bossTurn: 0,
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
      ? `${target} = ${attacker} × ${target / attacker} · 배수 관계를 찾아 치료 성공!`
      : `${target}은(는) ${attacker}의 배수가 아니에요.`;
  }
  return `${attacker}을(를) 곱셈식의 두 수로 나누어 치료 길을 만들었어요.`;
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
      ? `보스 치료 성공! 앞으로 ${bossHp}번 더 치료해야 해요. 숫자가 ${numbers[battle.bossIndex ?? 0]}(으)로 바뀌었어요.`
      : feedback,
    bossHit,
  };
}

export function chooseStoryAiMove(battle: StoryBattle, stage: StoryStage): { move: Move; mode: StoryMode } | null {
  const livingBossIndex = stage.boss && battle.bossHp > 0 ? battle.bossIndex : null;
  const availableMoves = legalMoves(battle.board, 2)
    .filter((move) => move.from !== livingBossIndex);
  const moves = stage.enemyMovement === "jump-only"
    ? availableMoves.filter((move) => move.distance === 2)
    : availableMoves;
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
      relationText: "움직일 수 있는 칸이 없어 연구소가 긴급 치료 빛을 보냈습니다. 가장 가까운 질병 세균 1개를 없애 작전을 계속할 수 있어요.",
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
        relationText: "보스에게 다가갈 칸이 없어 연구소가 치료 세균 1개를 게임판에서 뺐습니다. 열린 칸으로 움직여 보스 치료를 계속하세요.",
      };
    }
  }

  return null;
}

export function applyBossTurn(battle: StoryBattle, stage: StoryStage): StoryMoveResult {
  if (!stage.boss || battle.bossIndex === null || battle.bossHp <= 0) {
    return { ...battle, infected: [], resisted: [], relationText: "", bossHit: false };
  }
  const board = [...battle.board];
  const numbers = [...battle.numbers];
  const bossTurn = battle.bossTurn + 1;
  const bossPhase = (battle.bossPhase + 1) % stage.boss.sequence.length;
  const bossNumber = stage.boss.sequence[bossPhase];
  numbers[battle.bossIndex] = bossNumber;

  if (bossTurn % 2 === 0) {
    const base = { ...battle, board, numbers, bossPhase, bossTurn };
    const moves = legalMoves(board, 2)
      .filter((move) => move.from === battle.bossIndex && move.distance === 1);
    const modes = stage.modes.filter((mode) => mode !== "split") as StoryMode[];
    const candidateModes: StoryMode[] = modes.length ? modes : ["divisor"];
    const scored = moves.flatMap((move) => candidateModes.map((mode) => {
      const preview = applyStoryMove(base, stage, 2, move, mode);
      return { move, mode, value: preview.infected.length * 12 + Math.random() * 2 };
    })).sort((left, right) => right.value - left.value);
    const action = scored[0];

    if (action) {
      const moved = applyStoryMove(base, stage, 2, action.move, action.mode);
      moved.numbers[action.move.to] = bossNumber;
      return {
        ...moved,
        bossIndex: action.move.to,
        bossPhase,
        bossTurn,
        relationText: moved.infected.length
          ? `보스가 질병 세균을 남기고 한 칸 복제 이동해 치료 세균 ${moved.infected.length}개를 감염시켰어요.`
          : "보스가 질병 세균을 남기고 인접한 칸으로 복제 이동했어요.",
        bossHit: false,
      };
    }
  }

  return {
    ...battle,
    board,
    numbers,
    bossPhase,
    bossTurn,
    infected: [],
    resisted: [],
    relationText: bossTurn % 2 === 0
      ? `보스가 ${bossNumber}(으)로 수를 바꾸었지만 복제할 빈칸을 찾지 못했어요.`
      : `보스가 ${bossNumber}(으)로 수를 바꾸고 다음 턴의 복제 이동을 준비해요.`,
    bossHit: false,
  };
}
