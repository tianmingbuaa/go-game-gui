import type { AIEngine, AIEngineInfo, AIMove, AIMoveRequest } from '../../../shared/ai'
import {
  BOARD_SIZE,
  EMPTY,
  type Board,
  type Stone
} from '../../../shared/game/types'
import {
  DIRECTIONS,
  getCell,
  isBoard,
  isInside,
  isLegalMove,
  nearbyEmptyIndexes,
  toIndex,
  toPosition,
  wouldWin
} from '../../../shared/game/rules'

interface RankedMove {
  index: number
  attack: number
  defense: number
  score: number
  reason: string
}

const CENTER = Math.floor(BOARD_SIZE / 2)
const WIN_SCORE = 3_000_000

// A window is a five-cell segment through the candidate point. These values
// reward building longer runs. Defence is weighted slightly higher below.
const WINDOW_SCORES = [0, 0, 16, 280, 6_800, 260_000]

const LEVEL_IDS = ['easy', 'normal'] as const
type LevelId = (typeof LEVEL_IDS)[number]

/**
 * A dependency-free, single-ply heuristic engine.
 *
 * It always takes an immediate win and always blocks an immediate loss, then
 * ranks moves by a combination of attack and defence pattern scores. The
 * "easy" level sometimes chooses a slightly less optimal move from the top
 * candidates, while "normal" always chooses the highest-ranked move.
 */
export class ClassicHeuristicAI implements AIEngine {
  readonly info: AIEngineInfo = {
    id: 'classic-heuristic',
    name: '墨弈 · 启发式',
    version: '1.0.0',
    description: '轻量级攻守评分引擎，落子迅速，适合日常对弈。',
    levels: [
      {
        id: 'easy',
        name: '轻松',
        description: '会全力争胜，但偶尔会放过次优的进攻机会。'
      },
      {
        id: 'normal',
        name: '标准',
        description: '攻守均衡，会优先封堵有威胁的棋形。'
      }
    ]
  }

  async chooseMove(request: Readonly<AIMoveRequest>, signal?: AbortSignal): Promise<AIMove> {
    assertNotAborted(signal)
    validateRequest(request, this.info)

    const { board, aiStone, opponentStone } = request

    if (board.every((cell) => cell !== EMPTY)) {
      throw new Error('棋盘已满，没有可落子的位置')
    }

    // Opening move: the centre is the strongest and most elegant start.
    if (board.every((cell) => cell === EMPTY)) {
      return { index: toIndex(CENTER, CENTER), score: 0, reason: '占据天元' }
    }

    let candidates = nearbyEmptyIndexes(board, 2)
    if (candidates.length === 0) {
      candidates = board
        .map((cell, index) => (cell === EMPTY ? index : -1))
        .filter((index) => index >= 0)
    }

    assertNotAborted(signal)

    // 1. Win immediately when possible.
    const winningMove = candidates.find((index) => wouldWin(board, index, aiStone))
    if (winningMove !== undefined) {
      return { index: winningMove, score: WIN_SCORE, reason: '连成五子' }
    }

    // 2. Block every immediate losing point. With several threats we pick the
    //    block that also creates the strongest counter-attack.
    const losingPoints = candidates.filter((index) => wouldWin(board, index, opponentStone))
    if (losingPoints.length > 0) {
      const rankedLosingPoints = losingPoints
        .map((index) => rankMove(board, index, aiStone, opponentStone))
        .sort((a, b) => b.score - a.score)
      const block = rankedLosingPoints[0]
      if (!block) throw new Error('AI 未能找到封堵点')
      return {
        index: block.index,
        score: block.score,
        reason: losingPoints.length > 1 ? '封堵多处杀棋' : '封堵对手成五'
      }
    }

    assertNotAborted(signal)

    const ranked = candidates
      .map((index) => rankMove(board, index, aiStone, opponentStone))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return centerDistance(a.index) - centerDistance(b.index)
      })

    const best = ranked[0]
    if (!best) {
      throw new Error('AI 未找到可落子的位置')
    }

    const level = request.level as LevelId
    if (level === 'easy' && ranked.length > 1 && Math.random() < 0.35) {
      const pool = ranked.slice(0, Math.min(5, ranked.length))
      const chosen = pool[Math.floor(Math.random() * pool.length)] ?? best
      return { index: chosen.index, score: chosen.score, reason: '轻松走子' }
    }

    return { index: best.index, score: best.score, reason: best.reason }
  }
}

function rankMove(
  board: Board,
  index: number,
  aiStone: Stone,
  opponentStone: Stone
): RankedMove {
  const attack = evaluatePlacement(board, index, aiStone)
  const defense = evaluatePlacement(board, index, opponentStone)
  const centerBonus = Math.max(0, 14 - centerDistance(index)) * 3
  const score = attack + defense * 1.18 + centerBonus

  return {
    index,
    attack,
    defense,
    score,
    reason: defense > attack * 1.1 ? '抢占要点，兼顾防守' : '展开进攻棋形'
  }
}

/**
 * Scores a hypothetical placement for `stone`. Every legal five-cell window
 * containing the point is examined, with extra weight for contiguous runs.
 */
function evaluatePlacement(board: Board, index: number, stone: Stone): number {
  if (!isLegalMove(board, index)) return 0
  const { row, col } = toPosition(index)
  let score = 0

  for (const [dr, dc] of DIRECTIONS) {
    // Sliding five-cell windows that include the hypothetical stone.
    for (let offset = -4; offset <= 0; offset += 1) {
      const startRow = row + dr * offset
      const startCol = col + dc * offset
      let own = 0
      let blocked = false
      let valid = true

      for (let step = 0; step < 5; step += 1) {
        const nextRow = startRow + dr * step
        const nextCol = startCol + dc * step
        if (!isInside(nextRow, nextCol)) {
          valid = false
          break
        }
        if (nextRow === row && nextCol === col) {
          own += 1
          continue
        }
        const cell = getCell(board, nextRow, nextCol)
        if (cell === stone) own += 1
        else if (cell !== EMPTY) {
          blocked = true
          break
        }
      }

      if (valid && !blocked) {
        score += WINDOW_SCORES[own] ?? 0
      }
    }

    // Contiguous shape score: a run of three with two open ends is much more
    // valuable than a closed run of three.
    let run = 1
    let openEnds = 0

    for (const sign of [-1, 1] as const) {
      let nextRow = row + dr * sign
      let nextCol = col + dc * sign

      while (isInside(nextRow, nextCol)) {
        const cell = getCell(board, nextRow, nextCol)
        if (cell === stone) {
          run += 1
          nextRow += dr * sign
          nextCol += dc * sign
          continue
        }
        if (cell === EMPTY) openEnds += 1
        break
      }
    }

    score += contiguousScore(run, openEnds)
  }

  return score
}

function contiguousScore(run: number, openEnds: number): number {
  if (run >= 5) return WIN_SCORE
  if (openEnds === 0) return 0
  if (run === 4) return openEnds === 2 ? 180_000 : 24_000
  if (run === 3) return openEnds === 2 ? 6_500 : 820
  if (run === 2) return openEnds === 2 ? 320 : 46
  return openEnds === 2 ? 18 : 4
}

function centerDistance(index: number): number {
  const { row, col } = toPosition(index)
  return Math.abs(row - CENTER) + Math.abs(col - CENTER)
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('AI 请求已取消')
  }
}

function validateRequest(request: Readonly<AIMoveRequest>, info: AIEngineInfo): void {
  if (!isBoard(request.board)) {
    throw new Error('棋盘数据无效')
  }
  if (request.aiStone === request.opponentStone) {
    throw new Error('AI 与对手的棋色不能相同')
  }
  if (!info.levels.some((level) => level.id === request.level)) {
    throw new Error(`不支持的 AI 难度：${request.level}`)
  }
}
