import { describe, expect, it } from 'vitest'
import type { AIMoveRequest } from '../src/shared/ai'
import { BLACK, WHITE, type Board, type Stone } from '../src/shared/game/types'
import {
  createEmptyBoard,
  placeStone,
  toIndex,
  toPosition,
  wouldWin
} from '../src/shared/game/rules'
import { ClassicHeuristicAI } from '../src/main/ai/engines/classic'
import { DefaultAIEngineRegistry } from '../src/main/ai/registry'

function boardWith(stones: Array<[number, number, Stone]>): Board {
  let board = createEmptyBoard()
  for (const [row, col, stone] of stones) {
    board = placeStone(board, toIndex(row, col), stone)
  }
  return board
}

function requestFor(
  board: Board,
  level = 'normal',
  aiStone: Stone = BLACK,
  opponentStone: Stone = WHITE
): AIMoveRequest {
  return {
    board,
    aiStone,
    opponentStone,
    history: [],
    level
  }
}

describe('ClassicHeuristicAI', () => {
  const engine = new ClassicHeuristicAI()

  it('opens at the centre on an empty board', async () => {
    const move = await engine.chooseMove(requestFor(createEmptyBoard()))
    expect(move.index).toBe(toIndex(7, 7))
  })

  it('takes an immediate winning move', async () => {
    const board = boardWith([
      [7, 4, BLACK],
      [7, 5, BLACK],
      [7, 6, BLACK],
      [7, 7, BLACK],
      [8, 8, WHITE]
    ])
    const move = await engine.chooseMove(requestFor(board))
    expect(wouldWin(board, move.index, BLACK)).toBe(true)
    expect(board[move.index]).toBe(0)
  })

  it('blocks an immediate losing point', async () => {
    const board = boardWith([
      [7, 4, WHITE],
      [7, 5, WHITE],
      [7, 6, WHITE],
      [7, 7, WHITE],
      [3, 3, BLACK]
    ])
    const move = await engine.chooseMove(requestFor(board))
    const { col } = toPosition(move.index)
    expect(toPosition(move.index).row).toBe(7)
    expect([3, 8]).toContain(col)
    expect(wouldWin(placeStone(board, move.index, BLACK), move.index, WHITE)).toBe(false)
  })

  it('returns a legal empty point in a complex mid-game position', async () => {
    const board = boardWith([
      [7, 7, BLACK],
      [7, 8, WHITE],
      [8, 8, BLACK],
      [6, 6, WHITE],
      [8, 7, BLACK],
      [6, 8, WHITE],
      [9, 6, BLACK],
      [5, 8, WHITE],
      [9, 9, BLACK]
    ])
    const move = await engine.chooseMove(requestFor(board, 'easy'))
    expect(move.index).toBeGreaterThanOrEqual(0)
    expect(move.index).toBeLessThan(225)
    expect(board[move.index]).toBe(0)
  })

  it('works when playing as white', async () => {
    const board = boardWith([
      [7, 7, BLACK],
      [7, 8, WHITE],
      [8, 8, BLACK]
    ])
    const move = await engine.chooseMove(requestFor(board, 'normal', WHITE, BLACK))
    expect(board[move.index]).toBe(0)
  })

  it('does not mutate the supplied board', async () => {
    const board = boardWith([[7, 7, BLACK]])
    const snapshot = [...board]
    await engine.chooseMove(requestFor(board))
    expect([...board]).toEqual(snapshot)
  })

  it('honours an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      engine.chooseMove(requestFor(createEmptyBoard()), controller.signal)
    ).rejects.toThrow('取消')
  })

  it('rejects an unknown difficulty level', async () => {
    await expect(
      engine.chooseMove(requestFor(createEmptyBoard(), 'impossible'))
    ).rejects.toThrow('难度')
  })

  it('rejects a full board with no legal answer', async () => {
    let board = createEmptyBoard()
    for (let index = 0; index < board.length; index += 1) {
      board = placeStone(board, index, index % 2 === 0 ? BLACK : WHITE)
    }
    await expect(engine.chooseMove(requestFor(board))).rejects.toThrow('棋盘已满')
  })

  it('exposes stable metadata and levels', () => {
    expect(engine.info.id).toBe('classic-heuristic')
    expect(engine.info.levels.map((level) => level.id)).toEqual(['easy', 'normal'])
    expect(engine.info.version).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('DefaultAIEngineRegistry', () => {
  it('registers, lists and removes engines', () => {
    const registry = new DefaultAIEngineRegistry()
    const engine = new ClassicHeuristicAI()

    registry.register(engine)
    expect(registry.get('classic-heuristic')).toBe(engine)
    expect(registry.list()).toHaveLength(1)
    expect(registry.unregister('classic-heuristic')).toBe(true)
    expect(registry.list()).toHaveLength(0)
  })

  it('rejects duplicate engine ids', () => {
    const registry = new DefaultAIEngineRegistry()
    registry.register(new ClassicHeuristicAI())
    expect(() => registry.register(new ClassicHeuristicAI())).toThrow('已注册')
  })
})
