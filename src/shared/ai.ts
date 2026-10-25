/**
 * Public AI contract.
 *
 * New engines only need to implement `AIEngine` and be registered in the main
 * process registry. The renderer discovers engines through IPC, so no renderer
 * changes are required when an engine is added.
 */
import type { Board, Move, Stone } from './game/types'

export interface AIEngineLevel {
  id: string
  name: string
  description: string
}

export interface AIEngineInfo {
  id: string
  name: string
  version: string
  description: string
  levels: readonly AIEngineLevel[]
}

export interface AIMoveRequest {
  /** Current position. Engines must not mutate this array. */
  board: Board
  aiStone: Stone
  opponentStone: Stone
  /** Moves played so far, oldest first. */
  history: readonly Move[]
  level: string
}

export interface AIMove {
  /** Flat board index: row * 15 + column. */
  index: number
  /** Optional human-readable explanation, useful for tuning and debugging. */
  reason?: string
  /** Optional engine evaluation score. */
  score?: number
}

/**
 * The extension point for all AI implementations.
 *
 * `signal` is aborted when the caller no longer needs the result or when the
 * engine exceeds its time budget. Long-running engines should check it.
 */
export interface AIEngine {
  readonly info: AIEngineInfo
  chooseMove(request: Readonly<AIMoveRequest>, signal?: AbortSignal): Promise<AIMove>
}

export interface AIEngineRegistry {
  register(engine: AIEngine): void
  unregister(engineId: string): boolean
  list(): readonly AIEngineInfo[]
  get(engineId: string): AIEngine | undefined
}

export interface AIChooseMovePayload {
  engineId: string
  board: Board
  aiStone: Stone
  opponentStone: Stone
  history: readonly Move[]
  level: string
}

export type AIChooseMoveResult =
  | {
      ok: true
      engineId: string
      move: AIMove
      elapsedMs: number
    }
  | {
      ok: false
      error: string
    }
