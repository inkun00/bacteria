export type Player = 1 | 2;
export type Cell = 0 | Player;
export type RelationMode = "divisor" | "multiple" | "split";
export type NumberCell = number | null;
export type BoardSize = 7 | 9 | 11;

export type Move = {
  from: number;
  to: number;
  distance: 1 | 2;
};

export type AiAction = {
  move: Move;
  mode: RelationMode;
  useBomb: boolean;
};

export const BOARD_SIZE = 7;

export function getBoardSize(board: Cell[]) {
  const size = Math.sqrt(board.length);
  return Number.isInteger(size) ? size : BOARD_SIZE;
}

function isPrime(value: number) {
  if (value < 2) return false;
  for (let divisor = 2; divisor * divisor <= value; divisor += 1) {
    if (value % divisor === 0) return false;
  }
  return true;
}

export const COMPOSITE_NUMBERS = Array.from({ length: 97 }, (_, index) => index + 4)
  .filter((value) => !isPrime(value));

const TIMES_TABLE_SET = new Set(
  Array.from({ length: 8 }, (_, left) => left + 2)
    .flatMap((left) => Array.from({ length: 8 }, (_, right) => left * (right + 2))),
);

export const TIMES_TABLE_NUMBERS = COMPOSITE_NUMBERS.filter((value) => TIMES_TABLE_SET.has(value));
export const OTHER_COMPOSITE_NUMBERS = COMPOSITE_NUMBERS.filter((value) => !TIMES_TABLE_SET.has(value));
export const TIMES_TABLE_GENERATION_RATE = .9;

export function createBoard(size: BoardSize = BOARD_SIZE): Cell[] {
  const board = Array<Cell>(size * size).fill(0);
  board[0] = 1;
  board[size * size - 1] = 1;
  board[size - 1] = 2;
  board[size * (size - 1)] = 2;
  return board;
}

export function randomNumber() {
  const pool = Math.random() < TIMES_TABLE_GENERATION_RATE
    ? TIMES_TABLE_NUMBERS
    : OTHER_COMPOSITE_NUMBERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function compositeNumberAt(seed: number) {
  const normalized = Math.abs(seed);
  const pool = normalized % 10 < TIMES_TABLE_GENERATION_RATE * 10
    ? TIMES_TABLE_NUMBERS
    : OTHER_COMPOSITE_NUMBERS;
  return pool[Math.floor(normalized / 10) % pool.length];
}

export function relatedNumbers(value: number, mode: RelationMode) {
  if (mode === "divisor") {
    const properDivisors = Array.from(
      { length: Math.max(0, value - 2) },
      (_, index) => index + 2,
    ).filter((candidate) => value % candidate === 0);
    if (properDivisors.length) return properDivisors;
    return [value];
  }
  if (mode === "multiple") {
    return COMPOSITE_NUMBERS.filter((candidate) => candidate % value === 0);
  }
  return [];
}

export function factorPairs(value: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let factor = 2; factor * factor <= value; factor += 1) {
    if (value % factor === 0) pairs.push([factor, value / factor]);
  }
  return pairs;
}

export function splitNumberAt(value: number, seed: number): [number, number] | null {
  const pairs = factorPairs(value);
  if (!pairs.length) return null;
  const pair = pairs[Math.abs(seed) % pairs.length];
  return Math.abs(seed) % 2 === 0 ? pair : [pair[1], pair[0]];
}

export function randomSplitNumbers(value: number): [number, number] | null {
  const pairs = factorPairs(value);
  if (!pairs.length) return null;
  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  return Math.random() < .5 ? pair : [pair[1], pair[0]];
}

export function relatedNumberAt(value: number, mode: RelationMode, seed: number) {
  const candidates = relatedNumbers(value, mode);
  return candidates[Math.abs(seed) % candidates.length] ?? value;
}

export function randomRelatedNumber(value: number, mode: RelationMode) {
  const candidates = relatedNumbers(value, mode);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? value;
}

export function createNumbers(board: Cell[] = createBoard()): NumberCell[] {
  return board.map((cell) => cell === 0 ? null : randomNumber());
}

export function getDistance(from: number, to: number, size: number = BOARD_SIZE) {
  const fromRow = Math.floor(from / size);
  const fromCol = from % size;
  const toRow = Math.floor(to / size);
  const toCol = to % size;
  return Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol));
}

export function isRelation(attacker: number, target: number, mode: RelationMode) {
  if (attacker <= 0 || target <= 0) return false;
  if (mode === "divisor") return attacker % target === 0;
  if (mode === "multiple") return target % attacker === 0;
  return false;
}

export function legalMoves(board: Cell[], player: Player): Move[] {
  const moves: Move[] = [];
  const size = getBoardSize(board);
  for (let from = 0; from < board.length; from += 1) {
    if (board[from] !== player) continue;
    const fromRow = Math.floor(from / size);
    const fromCol = from % size;
    for (let row = Math.max(0, fromRow - 2); row <= Math.min(size - 1, fromRow + 2); row += 1) {
      for (let col = Math.max(0, fromCol - 2); col <= Math.min(size - 1, fromCol + 2); col += 1) {
        const to = row * size + col;
        const distance = Math.max(Math.abs(row - fromRow), Math.abs(col - fromCol));
        if (board[to] === 0 && (distance === 1 || distance === 2)) {
          moves.push({ from, to, distance });
        }
      }
    }
  }
  return moves;
}

export function applyMove(
  board: Cell[],
  numbers: NumberCell[],
  player: Player,
  move: Move,
  mode: RelationMode,
  generators: {
    clone?: (value: number, relation: RelationMode) => number;
    infection?: () => number;
    split?: (value: number) => [number, number] | null;
    forceInfection?: boolean;
  } = {},
) {
  const next = [...board];
  const nextNumbers = [...numbers];
  const attackerNumber = numbers[move.from] ?? 2;

  if (move.distance === 2) {
    next[move.from] = 0;
    nextNumbers[move.from] = null;
    nextNumbers[move.to] = attackerNumber;
  } else if (mode === "split") {
    const splitNumbers = generators.split?.(attackerNumber) ?? randomSplitNumbers(attackerNumber);
    if (splitNumbers) {
      nextNumbers[move.from] = splitNumbers[0];
      nextNumbers[move.to] = splitNumbers[1];
    } else {
      nextNumbers[move.to] = attackerNumber;
    }
  } else {
    nextNumbers[move.to] = generators.clone?.(attackerNumber, mode)
      ?? randomRelatedNumber(attackerNumber, mode);
  }
  next[move.to] = player;

  const infectionNumber = mode === "split"
    ? nextNumbers[move.to] ?? attackerNumber
    : attackerNumber;
  const infectionMode: RelationMode = mode === "split" ? "multiple" : mode;

  const infected: number[] = [];
  const resisted: number[] = [];
  const size = getBoardSize(board);
  const row = Math.floor(move.to / size);
  const col = move.to % size;
  for (let y = Math.max(0, row - 1); y <= Math.min(size - 1, row + 1); y += 1) {
    for (let x = Math.max(0, col - 1); x <= Math.min(size - 1, col + 1); x += 1) {
      const index = y * size + x;
      if (next[index] !== 0 && next[index] !== player) {
        const targetNumber = nextNumbers[index] ?? 0;
        if (generators.forceInfection || isRelation(infectionNumber, targetNumber, infectionMode)) {
          next[index] = player;
          nextNumbers[index] = generators.infection?.() ?? randomNumber();
          infected.push(index);
        } else {
          resisted.push(index);
        }
      }
    }
  }
  return {
    board: next,
    numbers: nextNumbers,
    infected,
    resisted,
    attackerNumber,
    infectionNumber,
    parentNumber: move.distance === 1 ? nextNumbers[move.from] ?? attackerNumber : attackerNumber,
    spawnedNumber: nextNumbers[move.to] ?? attackerNumber,
  };
}

export function score(board: Cell[]) {
  return board.reduce(
    (result, cell) => {
      if (cell === 1) result[0] += 1;
      if (cell === 2) result[1] += 1;
      return result;
    },
    [0, 0],
  );
}

function positionWeight(index: number, size: number) {
  const row = Math.floor(index / size);
  const col = index % size;
  const corner = (row === 0 || row === size - 1) && (col === 0 || col === size - 1);
  const edge = row === 0 || col === 0 || row === size - 1 || col === size - 1;
  return corner ? 9 : edge ? 3 : 0;
}

function evaluate(board: Cell[], player: Player) {
  const opponent = player === 1 ? 2 : 1;
  const size = getBoardSize(board);
  const counts = score(board);
  const pieceScore = (counts[player - 1] - counts[opponent - 1]) * 14;
  const mobility = legalMoves(board, player).length - legalMoves(board, opponent).length;
  let territory = 0;
  board.forEach((cell, index) => {
    if (cell === player) territory += positionWeight(index, size);
    if (cell === opponent) territory -= positionWeight(index, size);
  });
  return pieceScore + mobility * 0.8 + territory;
}

function bombWouldHelp(
  board: Cell[],
  numbers: NumberCell[],
  player: Player,
  move: Move,
  mode: RelationMode,
) {
  const attackerNumber = numbers[move.from] ?? 0;
  const size = getBoardSize(board);
  const row = Math.floor(move.to / size);
  const col = move.to % size;
  for (let y = Math.max(0, row - 1); y <= Math.min(size - 1, row + 1); y += 1) {
    for (let x = Math.max(0, col - 1); x <= Math.min(size - 1, col + 1); x += 1) {
      const index = y * size + x;
      const targetNumber = numbers[index] ?? 0;
      if (board[index] !== 0 && board[index] !== player && !isRelation(attackerNumber, targetNumber, mode)) {
        return true;
      }
    }
  }
  return false;
}

function legalActions(board: Cell[], numbers: NumberCell[], player: Player, canUseBomb = false): AiAction[] {
  return legalMoves(board, player).flatMap((move) => {
    const actions: AiAction[] = [
      { move, mode: "divisor", useBomb: false },
      { move, mode: "multiple", useBomb: false },
    ];
    if (canUseBomb) {
      (["divisor", "multiple"] as RelationMode[]).forEach((mode) => {
        if (bombWouldHelp(board, numbers, player, move, mode)) {
          actions.push({ move, mode, useBomb: true });
        }
      });
    }
    if (move.distance === 1 && factorPairs(numbers[move.from] ?? 0).length) {
      actions.push({ move, mode: "split", useBomb: false });
      if (canUseBomb && bombWouldHelp(board, numbers, player, move, "split")) {
        actions.push({ move, mode: "split", useBomb: true });
      }
    }
    return actions;
  });
}

function simulatedGeneratedNumber(action: AiAction, depth: number) {
  return compositeNumberAt(action.move.from * 3 + action.move.to + depth);
}

function simulationGenerators(action: AiAction, depth: number) {
  return {
    clone: (value: number, mode: RelationMode) => relatedNumberAt(value, mode, action.move.to + depth),
    infection: () => simulatedGeneratedNumber(action, depth),
    split: (value: number) => splitNumberAt(value, action.move.to + depth),
    forceInfection: action.useBomb,
  };
}

function minimax(
  board: Cell[],
  numbers: NumberCell[],
  player: Player,
  maximizingFor: Player,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const actions = legalActions(board, numbers, player);
  const opponent = player === 1 ? 2 : 1;
  const opponentActions = legalActions(board, numbers, opponent);
  if (depth === 0 || (!actions.length && !opponentActions.length) || score(board).includes(0)) {
    return evaluate(board, maximizingFor);
  }
  if (!actions.length) return minimax(board, numbers, opponent, maximizingFor, depth - 1, alpha, beta);

  if (player === maximizingFor) {
    let best = -Infinity;
    for (const action of actions) {
      const next = applyMove(board, numbers, player, action.move, action.mode, simulationGenerators(action, depth));
      best = Math.max(best, minimax(next.board, next.numbers, opponent, maximizingFor, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const action of actions) {
    const next = applyMove(board, numbers, player, action.move, action.mode, simulationGenerators(action, depth));
    best = Math.min(best, minimax(next.board, next.numbers, opponent, maximizingFor, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Difficulty = "easy" | "medium" | "hard";

export function chooseAiAction(
  board: Cell[],
  numbers: NumberCell[],
  difficulty: Difficulty,
  player: Player = 2,
  bombCount = 0,
): AiAction | null {
  const actions = legalActions(board, numbers, player, bombCount > 0);
  if (!actions.length) return null;
  if (difficulty === "easy") return actions[Math.floor(Math.random() * actions.length)];

  const ranked = actions.map((action) => {
    const next = applyMove(board, numbers, player, action.move, action.mode, simulationGenerators(action, 1));
    const opponent = player === 1 ? 2 : 1;
    const value = difficulty === "hard"
      ? minimax(next.board, next.numbers, opponent, player, 1, -Infinity, Infinity)
      : evaluate(next.board, player);
    return { action, value: value + (difficulty === "medium" ? Math.random() * 7 : Math.random() * 0.15) };
  });
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0].action;
}
