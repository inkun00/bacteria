export type Player = 1 | 2;
export type Cell = 0 | Player;

export type Move = {
  from: number;
  to: number;
  distance: 1 | 2;
};

export const BOARD_SIZE = 7;

export function createBoard(): Cell[] {
  const board = Array<Cell>(BOARD_SIZE * BOARD_SIZE).fill(0);
  board[0] = 1;
  board[BOARD_SIZE * BOARD_SIZE - 1] = 1;
  board[BOARD_SIZE - 1] = 2;
  board[BOARD_SIZE * (BOARD_SIZE - 1)] = 2;
  return board;
}

export function getDistance(from: number, to: number) {
  const fromRow = Math.floor(from / BOARD_SIZE);
  const fromCol = from % BOARD_SIZE;
  const toRow = Math.floor(to / BOARD_SIZE);
  const toCol = to % BOARD_SIZE;
  return Math.max(Math.abs(fromRow - toRow), Math.abs(fromCol - toCol));
}

export function legalMoves(board: Cell[], player: Player): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < board.length; from += 1) {
    if (board[from] !== player) continue;
    const fromRow = Math.floor(from / BOARD_SIZE);
    const fromCol = from % BOARD_SIZE;
    for (let row = Math.max(0, fromRow - 2); row <= Math.min(BOARD_SIZE - 1, fromRow + 2); row += 1) {
      for (let col = Math.max(0, fromCol - 2); col <= Math.min(BOARD_SIZE - 1, fromCol + 2); col += 1) {
        const to = row * BOARD_SIZE + col;
        const distance = Math.max(Math.abs(row - fromRow), Math.abs(col - fromCol));
        if (board[to] === 0 && (distance === 1 || distance === 2)) {
          moves.push({ from, to, distance });
        }
      }
    }
  }
  return moves;
}

export function applyMove(board: Cell[], player: Player, move: Move) {
  const next = [...board];
  if (move.distance === 2) next[move.from] = 0;
  next[move.to] = player;

  const infected: number[] = [];
  const row = Math.floor(move.to / BOARD_SIZE);
  const col = move.to % BOARD_SIZE;
  for (let y = Math.max(0, row - 1); y <= Math.min(BOARD_SIZE - 1, row + 1); y += 1) {
    for (let x = Math.max(0, col - 1); x <= Math.min(BOARD_SIZE - 1, col + 1); x += 1) {
      const index = y * BOARD_SIZE + x;
      if (next[index] !== 0 && next[index] !== player) {
        next[index] = player;
        infected.push(index);
      }
    }
  }
  return { board: next, infected };
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

function positionWeight(index: number) {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const corner = (row === 0 || row === BOARD_SIZE - 1) && (col === 0 || col === BOARD_SIZE - 1);
  const edge = row === 0 || col === 0 || row === BOARD_SIZE - 1 || col === BOARD_SIZE - 1;
  return corner ? 9 : edge ? 3 : 0;
}

function evaluate(board: Cell[], player: Player) {
  const opponent = player === 1 ? 2 : 1;
  const counts = score(board);
  const pieceScore = (counts[player - 1] - counts[opponent - 1]) * 14;
  const mobility = legalMoves(board, player).length - legalMoves(board, opponent).length;
  let territory = 0;
  board.forEach((cell, index) => {
    if (cell === player) territory += positionWeight(index);
    if (cell === opponent) territory -= positionWeight(index);
  });
  return pieceScore + mobility * 0.8 + territory;
}

function minimax(board: Cell[], player: Player, maximizingFor: Player, depth: number, alpha: number, beta: number): number {
  const moves = legalMoves(board, player);
  const opponent = player === 1 ? 2 : 1;
  const opponentMoves = legalMoves(board, opponent);
  if (depth === 0 || (moves.length === 0 && opponentMoves.length === 0) || score(board).includes(0)) {
    return evaluate(board, maximizingFor);
  }
  if (moves.length === 0) return minimax(board, opponent, maximizingFor, depth - 1, alpha, beta);

  if (player === maximizingFor) {
    let best = -Infinity;
    for (const move of moves) {
      best = Math.max(best, minimax(applyMove(board, player, move).board, opponent, maximizingFor, depth - 1, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  let best = Infinity;
  for (const move of moves) {
    best = Math.min(best, minimax(applyMove(board, player, move).board, opponent, maximizingFor, depth - 1, alpha, beta));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
}

export type Difficulty = "easy" | "medium" | "hard";

export function chooseAiMove(board: Cell[], difficulty: Difficulty, player: Player = 2): Move | null {
  const moves = legalMoves(board, player);
  if (!moves.length) return null;
  if (difficulty === "easy") return moves[Math.floor(Math.random() * moves.length)];

  const ranked = moves.map((move) => {
    const next = applyMove(board, player, move).board;
    const depth = difficulty === "hard" ? (moves.length < 18 ? 3 : 2) : 1;
    const opponent = player === 1 ? 2 : 1;
    const value = depth === 1 ? evaluate(next, player) : minimax(next, opponent, player, depth - 1, -Infinity, Infinity);
    return { move, value: value + (difficulty === "medium" ? Math.random() * 7 : Math.random() * 0.15) };
  });
  ranked.sort((a, b) => b.value - a.value);
  return ranked[0].move;
}
