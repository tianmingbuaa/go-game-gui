import type {
  AIEngine,
  AIEngineInfo,
  AIMove,
  AIMoveRequest
} from '../../../../shared/ai'
import {
  EMPTY,
  otherStone,
  type Stone
} from '../../../../shared/game/types'
import { isBoard } from '../../../../shared/game/rules'
import {
  CENTER_INDEX,
  Position,
  SEARCH_INFINITY,
  WIN_SCORE,
  WIN_THRESHOLD,
  type MoveAnalysis,
  type ScoredPoint
} from './position'
import { findVcf } from './vcf'

const LEVEL_ID = 'winning'
const DEFAULT_TIME_LIMIT_MS = 2_000
const DEFAULT_VCF_TIME_MS = 600
const DEFAULT_MAX_DEPTH = 10
const DEFAULT_ROOT_WIDTH = 18
const MAX_PLY = 40

export interface FirstPlayerOptions {
  /** Total thinking budget per move, in milliseconds. */
  timeLimitMs?: number
  /** Portion of the budget reserved for the VCF forcing search. */
  vcfTimeMs?: number
  /** Maximum even alpha-beta depth. */
  maxDepth?: number
  /** Root candidate width. */
  rootWidth?: number
}

class SearchStopped extends Error {}

/**
 * 先手必胜引擎.
 *
 * Black (the first player) has a theoretical win in 15x15 freestyle Gomoku.
 * This engine executes that advantage with three layers:
 *
 *  1. hard tactical rules (win in one, block a loss in one),
 *  2. a sound VCF (continuous-four) forcing search,
 *  3. iterative-deepening negamax with threat-aware move ordering.
 *
 * The evaluator rewards open threes, fours and double threats far above loose
 * development, so the search naturally steers toward the double-threat nets
 * that decide freestyle games. The VCF layer only reports lines it can prove;
 * the alpha-beta layer supplies the plans that create those forcing points.
 */
export class FirstPlayerAI implements AIEngine {
  readonly info: AIEngineInfo = {
    id: 'first-player-win',
    name: '墨弈 · 先手必胜',
    version: '1.0.0',
    description:
      '固定执黑先行。以天元开局，连续威胁搜索与深度攻杀结合，利用无禁手规则执行先手必胜策略。',
    levels: [
      {
        id: LEVEL_ID,
        name: '先手必胜',
        description: '全力攻杀，优先构筑活三、冲四与双威胁，不接受和棋。'
      }
    ]
  }

  private readonly timeLimitMs: number
  private readonly vcfTimeMs: number
  private readonly maxDepth: number
  private readonly rootWidth: number

  constructor(options: FirstPlayerOptions = {}) {
    this.timeLimitMs = options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS
    this.vcfTimeMs = options.vcfTimeMs ?? DEFAULT_VCF_TIME_MS
    this.maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH
    this.rootWidth = options.rootWidth ?? DEFAULT_ROOT_WIDTH
  }

  async chooseMove(request: Readonly<AIMoveRequest>, signal?: AbortSignal): Promise<AIMove> {
    assertNotAborted(signal)
    validateRequest(request, this.info)

    if (request.board.every((cell) => cell === EMPTY)) {
      return {
        index: CENTER_INDEX,
        score: 0,
        reason: '天元开局，先手主动'
      }
    }

    const start = now()
    const position = new Position(request.board)
    const candidates = position.candidateMoves()

    if (candidates.length === 0) {
      throw new Error('棋盘已满，没有可落子的位置')
    }

    const scored = scoreCandidates(position, request.aiStone, request.opponentStone, candidates)

    // 1. Take a win in one.
    const winningMove = scored.find((candidate) => candidate.attack.five)
    if (winningMove) {
      return {
        index: winningMove.index,
        score: WIN_SCORE,
        reason: '连成五子，直接取胜'
      }
    }

    // 2. Block an immediate loss. With two or more opponent wins the position
    //    is already lost, but we still occupy the strongest block.
    const losingMoves = scored.filter((candidate) => candidate.defense.five)
    if (losingMoves.length > 0) {
      losingMoves.sort(compareScoredPoints)
      const block = losingMoves[0]!
      return {
        index: block.index,
        score: block.score,
        reason:
          losingMoves.length > 1 ? '封堵对手多处成五' : '封堵对手成五'
      }
    }

    // 3. Prove a forcing win with continuous fours when a tactical base exists.
    if (position.stoneCount >= 4) {
      const vcfDeadline = Math.min(start + this.timeLimitMs, start + this.vcfTimeMs)
      const vcfLine = findVcf(position, request.aiStone, {
        maxDepth: 16,
        deadline: vcfDeadline,
        signal,
        maxNodes: 60_000
      })
      if (vcfLine && vcfLine.length > 0) {
        return {
          index: vcfLine[0]!,
          score: WIN_SCORE,
          reason: '连续冲四，锁定必胜'
        }
      }
    }

    // 4. Iterative-deepening alpha-beta for the strategic plan.
    const result = this.search(position, request, signal, start + this.timeLimitMs)
    if (result) {
      return {
        index: result.index,
        score: result.score,
        reason:
          result.score >= WIN_THRESHOLD
            ? '先手连续攻杀，锁定胜局'
            : result.reason
      }
    }

    // 5. Defensive fallback: the best heuristic point.
    scored.sort(compareScoredPoints)
    const fallback = scored[0]
    if (!fallback) throw new Error('AI 未找到可落子的位置')
    return {
      index: fallback.index,
      score: fallback.score,
      reason: '抢占攻守要点'
    }
  }

  private search(
    position: Position,
    request: Readonly<AIMoveRequest>,
    signal: AbortSignal | undefined,
    deadline: number
  ): { index: number; score: number; reason: string } | null {
    this.position = position
    this.turn = request.aiStone
    this.opponent = request.opponentStone
    this.signal = signal
    this.deadline = deadline
    this.nodes = 0

    let best: { index: number; score: number; reason: string } | null = null
    let previousBest: number | undefined

    for (let depth = 2; depth <= this.maxDepth; depth += 2) {
      try {
        const result = this.searchRoot(depth, previousBest)
        if (result) {
          best = result
          previousBest = result.index
        }
        if (best && best.score >= WIN_THRESHOLD) break
        if (now() >= deadline) break
      } catch (error) {
        if (error instanceof SearchStopped) break
        throw error
      }
    }

    return best
  }

  private searchRoot(
    depth: number,
    previousBest: number | undefined
  ): { index: number; score: number; reason: string } | null {
    const position = this.position!
    const candidates = scoreCandidates(
      position,
      this.turn!,
      this.opponent!,
      position.candidateMoves()
    )

    const ownWins = candidates.filter((candidate) => candidate.attack.five)
    if (ownWins.length > 0) {
      const win = ownWins[0]!
      return { index: win.index, score: WIN_SCORE, reason: '连成五子，直接取胜' }
    }

    const opponentWins = candidates.filter((candidate) => candidate.defense.five)
    let moves: ScoredPoint[]
    if (opponentWins.length === 1) {
      moves = [opponentWins[0]!]
    } else if (opponentWins.length > 1) {
      opponentWins.sort(compareScoredPoints)
      moves = opponentWins.slice(0, 1)
    } else if (hasOpenFourThreat(candidates)) {
      moves = criticalMoves(candidates, this.rootWidth)
    } else {
      moves = candidates.sort(compareScoredPoints).slice(0, this.rootWidth)
      appendOpenThreeBlocks(moves, candidates)
    }

    if (previousBest !== undefined) {
      const previousIndex = moves.findIndex((move) => move.index === previousBest)
      if (previousIndex > 0) {
        const [previous] = moves.splice(previousIndex, 1)
        if (previous) moves.unshift(previous)
      }
    }

    let alpha = -SEARCH_INFINITY
    const beta = SEARCH_INFINITY
    let bestIndex = moves[0]?.index ?? -1
    let bestScore = -SEARCH_INFINITY

    for (const move of moves) {
      this.checkStop()
      position.place(move.index, this.turn!)
      let score: number
      if (position.hasFiveAt(move.index, this.turn!)) {
        score = WIN_SCORE
      } else {
        const extension = isForcing(move.attack) ? 1 : 0
        score = -this.negamax(depth - 1 + extension, -beta, -alpha, this.opponent!, 1)
      }
      position.undo()

      if (score > bestScore) {
        bestScore = score
        bestIndex = move.index
      }
      if (score > alpha) alpha = score
    }

    if (bestIndex < 0) return null

    return {
      index: bestIndex,
      score: bestScore,
      reason:
        bestScore >= WIN_THRESHOLD
          ? '先手连续攻杀，锁定胜局'
          : bestScore <= -WIN_THRESHOLD
            ? '顽强防守，寻找反击'
            : '先手强攻，抢占要点'
    }
  }

  private negamax(
    depth: number,
    alpha: number,
    beta: number,
    turn: Stone,
    ply: number
  ): number {
    if (ply > MAX_PLY) return this.position!.evaluate(turn)
    this.nodes += 1
    if ((this.nodes & 127) === 0) this.checkStop()

    if (depth <= 0) return this.position!.evaluate(turn)

    const position = this.position!
    const opponent = otherStone(turn)
    const candidates = scoreCandidates(
      position,
      turn,
      opponent,
      position.candidateMoves()
    )

    const ownWins = candidates.filter((candidate) => candidate.attack.five)
    if (ownWins.length > 0) return WIN_SCORE - ply

    const opponentWins = candidates.filter((candidate) => candidate.defense.five)
    if (opponentWins.length >= 2) return -WIN_SCORE + ply

    let moves: ScoredPoint[]
    if (opponentWins.length === 1) {
      moves = [opponentWins[0]!]
    } else if (hasOpenFourThreat(candidates)) {
      moves = criticalMoves(candidates, searchWidth(depth))
    } else {
      candidates.sort(compareScoredPoints)
      moves = candidates.slice(0, searchWidth(depth))
      appendOpenThreeBlocks(moves, candidates)
    }

    let best = -SEARCH_INFINITY
    for (const move of moves) {
      this.checkStop()
      position.place(move.index, turn)

      let value: number
      if (position.hasFiveAt(move.index, turn)) {
        value = WIN_SCORE - ply
      } else {
        const extension = isForcing(move.attack) && ply < 16 ? 1 : 0
        value = -this.negamax(depth - 1 + extension, -beta, -alpha, opponent, ply + 1)
      }

      position.undo()

      if (value > best) best = value
      if (value > alpha) alpha = value
      if (alpha >= beta) break
    }

    return best
  }

  private checkStop(): void {
    if (this.signal?.aborted) throw new SearchStopped('aborted')
    if (now() >= this.deadline) throw new SearchStopped('timeout')
  }

  private position: Position | undefined
  private turn: Stone | undefined
  private opponent: Stone | undefined
  private signal: AbortSignal | undefined
  private deadline = Number.POSITIVE_INFINITY
  private nodes = 0
}

function scoreCandidates(
  position: Position,
  turn: Stone,
  opponent: Stone,
  candidates: readonly number[]
): ScoredPoint[] {
  const result: ScoredPoint[] = []

  for (const index of candidates) {
    const attack = position.analyze(index, turn)
    const defense = position.analyze(index, opponent)
    result.push({
      index,
      attack,
      defense,
      score: candidateScore(index, attack, defense)
    })
  }

  return result
}

function candidateScore(index: number, attack: MoveAnalysis, defense: MoveAnalysis): number {
  const row = Math.floor(index / 15)
  const col = index % 15
  const centerBonus = Math.max(0, 14 - (Math.abs(row - 7) + Math.abs(col - 7))) * 3
  let score = attack.score + defense.score * 0.92 + centerBonus

  // An opponent open-four maker is the single most urgent defensive point:
  // if they play it, the two completion points cannot both be blocked.
  if (defense.finishPoints.length >= 2) score += 2_000_000
  else if (defense.finishPoints.length === 1) score += 20_000
  if (defense.threeWindows >= 2) score += 40_000

  return score
}

/**
 * True when the opponent has a move that creates an open four. Such a move
 * wins two plies later and cannot be answered by a single block, so it must
 * be pre-empted immediately instead of merely ranked highly.
 */
function hasOpenFourThreat(candidates: readonly ScoredPoint[]): boolean {
  return candidates.some((candidate) => candidate.defense.finishPoints.length >= 2)
}

/**
 * Candidate set for a must-answer position. It contains the points that
 * pre-empt the opponent's open-four maker plus our own forcing fours; quiet
 * development is excluded because the opponent would simply win first.
 */
function criticalMoves(candidates: readonly ScoredPoint[], width: number): ScoredPoint[] {
  const urgent = candidates.filter(
    (candidate) =>
      candidate.defense.finishPoints.length >= 2 ||
      candidate.attack.finishPoints.length > 0 ||
      candidate.attack.five
  )
  const pool = urgent.length > 0 ? urgent : [...candidates]
  return pool.sort(compareScoredPoints).slice(0, width)
}

/**
 * A move that makes a four or an open three forces the opponent to answer in
 * a narrow way, so the search extends through it instead of letting the threat
 * fall beyond the horizon.
 */
function isForcing(analysis: MoveAnalysis): boolean {
  return analysis.finishPoints.length > 0 || analysis.threeWindows >= 2
}

/**
 * Make sure the two strongest points that would give the opponent an open
 * three are examined even when they are outside the normal candidate width.
 * This is not a win-or-lose rule like an open four, but it prevents the most
 * common horizon blunder: ignoring a quiet double-threat setup.
 */
function appendOpenThreeBlocks(moves: ScoredPoint[], candidates: readonly ScoredPoint[]): void {
  const blocks = candidates
    .filter((candidate) => candidate.defense.threeWindows >= 2)
    .sort(compareScoredPoints)
    .slice(0, 2)

  for (const block of blocks) {
    if (!moves.some((move) => move.index === block.index)) moves.push(block)
  }
}

function compareScoredPoints(a: ScoredPoint, b: ScoredPoint): number {
  if (b.score !== a.score) return b.score - a.score
  const centerA = Math.abs(Math.floor(a.index / 15) - 7) + Math.abs((a.index % 15) - 7)
  const centerB = Math.abs(Math.floor(b.index / 15) - 7) + Math.abs((b.index % 15) - 7)
  if (centerA !== centerB) return centerA - centerB
  return a.index - b.index
}

function searchWidth(depth: number): number {
  if (depth >= 8) return 6
  if (depth >= 6) return 8
  if (depth >= 4) return 10
  return 12
}

function now(): number {
  return performance.now()
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new Error('AI 请求已取消')
}

function validateRequest(request: Readonly<AIMoveRequest>, info: AIEngineInfo): void {
  if (!isBoard(request.board)) throw new Error('棋盘数据无效')
  if (request.aiStone === request.opponentStone) throw new Error('AI 与对手的棋色不能相同')
  if (!info.levels.some((level) => level.id === request.level)) {
    throw new Error(`不支持的 AI 难度：${request.level}`)
  }
}
