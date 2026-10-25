import { describe, expect, it } from 'vitest'
import {
  BLACK,
  BOARD_SIZE,
  EMPTY,
  WHITE,
  type Board,
  type Stone
} from '../src/shared/game/types'
import {
  checkWinAt,
  createEmptyBoard,
  findWinner,
  formatMoveLabel,
  isBoard,
  isBoardFull,
  isLegalMove,
  nearbyEmptyIndexes,
  placeStone,
  toIndex,
  toPosition,
  wouldWin
} from '../src/shared/game/rules'

function boardWith(stones: Array<[number, number, Stone]>): Board {
  let board = createEmptyBoard()
  for (const [row, col, stone] of stones) {
    board = placeStone(board, toIndex(row, col), stone)
  }
  return board
}

describe('gomoku rules', () => {
  it('creates a 15 by 15 empty board', () => {
    const board = createEmptyBoard()
    expect(board).toHaveLength(BOARD_SIZE * BOARD_SIZE)
    expect(board.every((cell) => cell === EMPTY)).toBe(true)
    expect(isBoard(board)).toBe(true)
  })

  it('converts between flat indexes and row/column positions', () => {
    expect(toIndex(7, 14)).toBe(119)
    expect(toPosition(119)).toEqual({ row: 7, col: 14 })
    expect(formatMoveLabel(0, 0)).toBe('A1')
    expect(formatMoveLabel(14, 14)).toBe('O15')
  })

  it('places stones immutably and rejects occupied or invalid points', () => {
    const empty = createEmptyBoard()
    const placed = placeStone(empty, toIndex(7, 7), BLACK)

    expect(empty[toIndex(7, 7)]).toBe(EMPTY)
    expect(placed[toIndex(7, 7)]).toBe(BLACK)
    expect(isLegalMove(placed, toIndex(7, 7))).toBe(false)
    expect(() => placeStone(placed, toIndex(7, 7), WHITE)).toThrow()
    expect(() => placeStone(empty, -1, BLACK)).toThrow()
    expect(() => placeStone(empty, 225, BLACK)).toThrow()
  })

  it.each([
    ['horizontal', [[7, 3], [7, 4], [7, 5], [7, 6], [7, 7]]],
    ['vertical', [[3, 7], [4, 7], [5, 7], [6, 7], [7, 7]]],
    ['diagonal', [[3, 3], [4, 4], [5, 5], [6, 6], [7, 7]]],
    ['anti-diagonal', [[3, 11], [4, 10], [5, 9], [6, 8], [7, 7]]]
  ])('detects a %s win', (_name, points) => {
    const stones = points as Array<[number, number]>
    const board = boardWith(stones.map(([row, col]) => [row, col, BLACK]))
    const lastIndex = toIndex(...(stones.at(-1) as [number, number]))
    const line = checkWinAt(board, lastIndex)

    expect(line).not.toBeNull()
    expect(line?.stone).toBe(BLACK)
    expect(line?.cells).toHaveLength(5)
    expect(findWinner(board)?.stone).toBe(BLACK)
  })

  it('does not count four stones as a win', () => {
    const board = boardWith([
      [7, 3, BLACK],
      [7, 4, BLACK],
      [7, 5, BLACK],
      [7, 6, BLACK]
    ])
    expect(checkWinAt(board, toIndex(7, 5))).toBeNull()
    expect(wouldWin(board, toIndex(7, 7), BLACK)).toBe(true)
    expect(wouldWin(board, toIndex(7, 7), WHITE)).toBe(false)
    expect(wouldWin(board, toIndex(7, 2), BLACK)).toBe(true)
  })

  it('does not wrap a line around the board edge', () => {
    const board = boardWith([
      [0, 12, BLACK],
      [0, 13, BLACK],
      [0, 14, BLACK],
      [1, 0, BLACK],
      [1, 1, BLACK]
    ])
    expect(findWinner(board)).toBeNull()
  })

  it('detects a draw when the board is full', () => {
    let board = createEmptyBoard()
    for (let index = 0; index < board.length; index += 1) {
      board = placeStone(board, index, index % 2 === 0 ? BLACK : WHITE)
    }
    expect(isBoardFull(board)).toBe(true)
    expect(isLegalMove(board, 0)).toBe(false)
  })

  it('returns nearby empty points for AI candidate generation', () => {
    const board = boardWith([[7, 7, BLACK]])
    const candidates = nearbyEmptyIndexes(board, 1)

    expect(candidates).toHaveLength(8)
    expect(candidates).toContain(toIndex(6, 6))
    expect(candidates).not.toContain(toIndex(7, 7))
    expect(candidates).not.toContain(toIndex(0, 0))
  })

  it('rejects malformed board payloads', () => {
    expect(isBoard([])).toBe(false)
    expect(isBoard(Array(225).fill(3))).toBe(false)
    expect(isBoard([1, 2, 3])).toBe(false)
    expect(isBoard('not a board')).toBe(false)
  })
})
