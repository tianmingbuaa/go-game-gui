import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WIN_LENGTH,
  WHITE,
  type Board,
  type Cell,
  type Stone,
  type WinningLine
} from './types'

export const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const

export function createEmptyBoard(): Board {
  return Array<Cell>(BOARD_SIZE * BOARD_SIZE).fill(EMPTY)
}

export function toIndex(row: number, col: number): number {
  return row * BOARD_SIZE + col
}

export function toPosition(index: number): { row: number; col: number } {
  return { row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE }
}

export function isInside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

export function getCell(board: Board, row: number, col: number): Cell {
  if (!isInside(row, col)) return EMPTY
  return board[toIndex(row, col)] ?? EMPTY
}

export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== EMPTY)
}

export function isLegalMove(board: Board, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < board.length && board[index] === EMPTY
}

export function placeStone(board: Board, index: number, stone: Stone): Board {
  if (!isLegalMove(board, index)) {
    throw new Error(`Illegal move at index ${index}`)
  }
  const next = board.slice()
  next[index] = stone
  return next
}

export function isBoard(value: unknown): value is Board {
  return (
    Array.isArray(value) &&
    value.length === BOARD_SIZE * BOARD_SIZE &&
    value.every((cell) => cell === EMPTY || cell === BLACK || cell === WHITE)
  )
}

/**
 * Returns the full contiguous line of five or more stones through `index`.
 * The stone at `index` must already exist on the board.
 */
export function checkWinAt(board: Board, index: number): WinningLine | null {
  const stone = board[index]
  if (stone !== BLACK && stone !== WHITE) return null

  const { row, col } = toPosition(index)

  for (const [dr, dc] of DIRECTIONS) {
    const cells: number[] = [index]

    for (const sign of [-1, 1] as const) {
      let nextRow = row + dr * sign
      let nextCol = col + dc * sign

      while (isInside(nextRow, nextCol) && getCell(board, nextRow, nextCol) === stone) {
        const nextIndex = toIndex(nextRow, nextCol)
        if (sign === -1) cells.unshift(nextIndex)
        else cells.push(nextIndex)
        nextRow += dr * sign
        nextCol += dc * sign
      }
    }

    if (cells.length >= WIN_LENGTH) {
      return { stone, cells }
    }
  }

  return null
}

/**
 * Scans the whole board for a winner. Used by tests and by defensive code paths;
 * normal gameplay can use the faster `checkWinAt` after each move.
 */
export function findWinner(board: Board): WinningLine | null {
  for (let index = 0; index < board.length; index += 1) {
    const stone = board[index]
    if (stone !== BLACK && stone !== WHITE) continue
    const line = checkWinAt(board, index)
    if (line) return line
  }
  return null
}

/**
 * True if placing `stone` at `index` would complete a line of five or more.
 * Unlike `checkWinAt`, this works on hypothetical future moves and does not
 * mutate the board.
 */
export function wouldWin(board: Board, index: number, stone: Stone): boolean {
  if (!isLegalMove(board, index)) return false
  const { row, col } = toPosition(index)

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1

    for (const sign of [-1, 1] as const) {
      let nextRow = row + dr * sign
      let nextCol = col + dc * sign

      while (isInside(nextRow, nextCol) && getCell(board, nextRow, nextCol) === stone) {
        count += 1
        nextRow += dr * sign
        nextCol += dc * sign
      }
    }

    if (count >= WIN_LENGTH) return true
  }

  return false
}

/** Neighbouring intersections within `radius`, ordered from the centre out. */
export function nearbyEmptyIndexes(board: Board, radius = 2): number[] {
  const seen = new Set<number>()
  const result: number[] = []

  for (let index = 0; index < board.length; index += 1) {
    if (board[index] === EMPTY) continue
    const { row, col } = toPosition(index)

    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const nextRow = row + dr
        const nextCol = col + dc
        if (!isInside(nextRow, nextCol)) continue
        const nextIndex = toIndex(nextRow, nextCol)
        if (board[nextIndex] !== EMPTY || seen.has(nextIndex)) continue
        seen.add(nextIndex)
        result.push(nextIndex)
      }
    }
  }

  return result
}

export function columnLabel(col: number): string {
  return String.fromCharCode(65 + col)
}

export function formatMoveLabel(row: number, col: number): string {
  return `${columnLabel(col)}${row + 1}`
}
