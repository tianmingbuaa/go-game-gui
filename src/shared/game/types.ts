/**
 * Shared game types. This module is used by both the Electron main process and
 * the renderer, so it must stay free of Node.js and Electron imports.
 */

export const BOARD_SIZE = 15
export const WIN_LENGTH = 5
export const EMPTY = 0
export const BLACK = 1
export const WHITE = 2

export type Stone = typeof BLACK | typeof WHITE
export type Cell = typeof EMPTY | Stone
export type Board = readonly Cell[]

/** Freestyle Gomoku: black always moves first. */
export const FIRST_PLAYER: Stone = BLACK
/** The answering player. */
export const SECOND_PLAYER: Stone = WHITE

export type GameMode = 'ai' | 'local'
export type GamePhase = 'playing' | 'won' | 'draw'

export interface Move {
  /** Flat board index: row * BOARD_SIZE + column. */
  index: number
  row: number
  col: number
  stone: Stone
  /** 1-based move number. */
  number: number
}

export interface WinningLine {
  stone: Stone
  /** Flat board indexes from one end of the line to the other. */
  cells: readonly number[]
}

export function otherStone(stone: Stone): Stone {
  return stone === BLACK ? WHITE : BLACK
}
