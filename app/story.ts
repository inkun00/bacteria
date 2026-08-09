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
