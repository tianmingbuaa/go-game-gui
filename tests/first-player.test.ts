import { describe, expect, it } from 'vitest'
import type { AIMoveRequest } from '../src/shared/ai'
import {
  BLACK,
  EMPTY,
  FIRST_PLAYER,
  SECOND_PLAYER,
  WHITE,
  type Board,
  type Stone
} from '../src/shared/game/types'
import {
  checkWinAt,
  createEmptyBoard,
  isBoardFull,
  placeStone,
  toIndex,
  wouldWin
} from '../src/shared/game/rules'
import { FirstPlayerAI } from '../src/main/ai/engines/first-player'
import { Position } from '../src/main/ai/engines/first-player/position'
import { findVcf } from '../src/main/ai/engines/first-player/vcf'
import { ClassicHeuristicAI } from '../src/main/ai/engines/classic'
import { createAIRegistry } from '../src/main/ai/registry'

function boardWith(stones: Array<[number, number, Stone]>): Board {
  let board = createEmptyBoard()
  for (const [row, col, stone] of stones) {
    board = placeStone(board, toIndex(row, col), stone)
  }
  return board
}

function requestFor(
  board: Board,
  level = 'winning',
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

interface PlayedGame {
  winner: Stone | 'draw' | null
  moves: number
}

/**
 * Plays black's engine against `white`. When `whiteFirstReply` is provided the
 * opening is fixed to black centre + that white reply, which lets the suite
 * cover white's most important first-move shapes deterministically.
 */
async function playGame(
  black: FirstPlayerAI,
  white: ClassicHeuristicAI,
  whiteFirstReply?: [number, number]
): Promise<PlayedGame> {
  let board: Board = createEmptyBoard()
  let history: Array<{ index: number; stone: Stone; row: number; col: number; number: number }> = []
  let turn: Stone = BLACK
  let winner: Stone | 'draw' | null = null

  if (whiteFirstReply) {
    const center = toIndex(7, 7)
    board = placeStone(board, center, BLACK)
    history.push({ index: center, stone: BLACK, row: 7, col: 7, number: 1 })
    const whiteIndex = toIndex(...whiteFirstReply)
    board = placeStone(board, whiteIndex, WHITE)
    history.push({
      index: whiteIndex,
      stone: WHITE,
      row: whiteFirstReply[0],
      col: whiteFirstReply[1],
      number: 2
    })
    turn = BLACK
  }

  for (let move = 0; move < 120; move += 1) {
    if (isBoardFull(board)) {
      winner = 'draw'
      break
    }

    const engine = turn === BLACK ? black : white
    const response = await engine.chooseMove({
      board,
      aiStone: turn,
      opponentStone: turn === BLACK ? WHITE : BLACK,
      history,
      level: turn === BLACK ? 'winning' : 'normal'
    })

    if (board[response.index] !== EMPTY) {
      throw new Error(`AI returned an occupied point: ${response.index}`)
    }

    board = placeStone(board, response.index, turn)
    history.push({
      index: response.index,
      stone: turn,
      row: Math.floor(response.index / 15),
      col: response.index % 15,
      number: history.length + 1
    })

    if (checkWinAt(board, response.index)) {
      winner = turn
      break
    }
    turn = turn === BLACK ? WHITE : BLACK
  }

  return { winner, moves: history.length }
}

const fastEngine = (): FirstPlayerAI =>
  new FirstPlayerAI({ timeLimitMs: 800, vcfTimeMs: 250, maxDepth: 8 })

describe('FirstPlayerAI', () => {
  const engine = new FirstPlayerAI({ timeLimitMs: 300, vcfTimeMs: 100, maxDepth: 6 })

  it('is the shipped AI and is built around black moving first', () => {
    const engines = createAIRegistry().list()
    expect(engines.map((entry) => entry.id)).toContain('first-player-win')
    expect(engines.map((entry) => entry.id)).not.toContain('classic-heuristic')
    expect(FIRST_PLAYER).toBe(BLACK)
    expect(SECOND_PLAYER).toBe(WHITE)
    expect(engine.info.id).toBe('first-player-win')
    expect(engine.info.levels.map((level) => level.id)).toEqual(['winning'])
    expect(engine.info.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('opens at the centre on an empty board', async () => {
    const move = await engine.chooseMove(requestFor(createEmptyBoard()))
    expect(move.index).toBe(toIndex(7, 7))
  })

  it('takes an immediate win', async () => {
    const board = boardWith([
      [7, 4, BLACK],
      [7, 5, BLACK],
      [7, 6, BLACK],
      [7, 7, BLACK],
      [8, 8, WHITE]
    ])
    const move = await engine.chooseMove(requestFor(board))
    expect(wouldWin(board, move.index, BLACK)).toBe(true)
  })

  it('proves a double-four VCF and restores the position', async () => {
    const board = boardWith([
      [7, 4, BLACK],
      [7, 5, BLACK],
      [7, 6, BLACK],
      [4, 7, BLACK],
      [5, 7, BLACK],
      [6, 7, BLACK],
      [7, 3, WHITE],
      [3, 7, WHITE],
      [10, 10, WHITE]
    ])
    const position = new Position(board)
    const line = findVcf(position, BLACK, {
      maxDepth: 6,
      deadline: performance.now() + 500,
      maxNodes: 10_000
    })

    expect(line).not.toBeNull()
    expect(line?.[0]).toBe(toIndex(7, 7))
    expect(Array.from(position.board)).toEqual(Array.from(board))
    expect(position.history).toEqual([])

    const move = await engine.chooseMove(requestFor(board))
    expect(move.index).toBe(toIndex(7, 7))
    expect(move.reason).toContain('冲四')
  })

  it('blocks a closed four, the only immediate loss', async () => {
    const board = boardWith([
      [7, 3, BLACK],
      [7, 4, WHITE],
      [7, 5, WHITE],
      [7, 6, WHITE],
      [7, 7, WHITE],
      [3, 3, BLACK]
    ])
    const move = await engine.chooseMove(requestFor(board))
    expect(move.index).toBe(toIndex(7, 8))
    expect(wouldWin(placeStone(board, move.index, BLACK), move.index, WHITE)).toBe(false)
  })

  it('returns a legal point in a mid-game position', async () => {
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
    const move = await engine.chooseMove(requestFor(board))
    expect(board[move.index]).toBe(EMPTY)
  })

  it('does not mutate the supplied board', async () => {
    const board = boardWith([
      [7, 7, BLACK],
      [6, 7, WHITE],
      [8, 8, BLACK]
    ])
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

  it('rejects a full board', async () => {
    let board = createEmptyBoard()
    for (let index = 0; index < board.length; index += 1) {
      board = placeStone(board, index, index % 2 === 0 ? BLACK : WHITE)
    }
    await expect(engine.chooseMove(requestFor(board))).rejects.toThrow('棋盘已满')
  })

  it('wins as black against the classic normal engine', async () => {
    const game = await playGame(fastEngine(), new ClassicHeuristicAI())
    expect(game.winner).toBe(BLACK)
    expect(game.moves).toBeGreaterThanOrEqual(5)
    expect(game.moves).toBeLessThan(120)
  }, 45_000)

  it('wins when white starts on an orthogonally adjacent point', async () => {
    const game = await playGame(fastEngine(), new ClassicHeuristicAI(), [6, 7])
    expect(game.winner).toBe(BLACK)
  }, 45_000)

  it('wins when white starts far from the centre', async () => {
    const game = await playGame(fastEngine(), new ClassicHeuristicAI(), [0, 0])
    expect(game.winner).toBe(BLACK)
  }, 45_000)
})
