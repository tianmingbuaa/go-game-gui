import {
  BOARD_SIZE,
  EMPTY,
  type Board,
  type Stone
} from '../../../../shared/game/types'

export const AREA = BOARD_SIZE * BOARD_SIZE
export const CENTER_INDEX = 7 * BOARD_SIZE + 7

export const WIN_SCORE = 10_000_000
export const WIN_THRESHOLD = 9_000_000
export const SEARCH_INFINITY = 1e15

/**
 * Four directions in (row, column) order. The engine reasons on flat indexes
 * (`row * BOARD_SIZE + column`) so it can keep the hot loops allocation free.
 */
export const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1]
] as const

/**
 * A five-cell window that is not blocked by the opponent is worth this much
 * for every stone of the evaluated colour inside it. The jump between a four
 * and an open three is intentionally large: the search must prefer forcing
 * shapes over loose development.
 */
const WINDOW_VALUE = [0, 1, 12, 220, 18_000, 600_000] as const

const FOUR_BONUS = 120_000
const OPEN_FOUR_BONUS = 1_100_000
const OPEN_THREE_BONUS = 70_000

/**
 * Whole-line shape values used by the leaf evaluator. Unlike the window sums
 * above, a maximal line is classified once so an open four (two distinct
 * completion points) dominates a simple four, and an open three dominates a
 * closed three. This is what makes the search prefer real double threats.
 */
const LINE_FIVE = 10_000_000
const LINE_OPEN_FOUR = 1_000_000
const LINE_FOUR = 100_000
const LINE_OPEN_THREE = 90_000
const LINE_THREE = 3_000
const LINE_OPEN_TWO = 2_500
const LINE_TWO = 300
const LINE_ONE = 30

/**
 * Pre-computed nine-cell neighbourhood for every point and direction. The
 * centre of the neighbourhood is `k = 4`; out-of-board cells are `-1`.
 */
const NBR9 = new Int16Array(DIRECTIONS.length * AREA * 9)

/** Points within Chebyshev distance 2, excluding the point itself. */
const RING2: Int16Array[] = new Array<Int16Array>(AREA)

/** Every maximal line that is long enough to contain five stones. */
const LINE_CELLS: Int16Array[] = []

/** `point * 4 + direction` -> line id, or -1 for lines shorter than five. */
const LINE_IDS = new Int16Array(AREA * 4).fill(-1)

;(function buildTables(): void {
  for (let d = 0; d < DIRECTIONS.length; d += 1) {
    const [dr, dc] = DIRECTIONS[d]!
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const index = row * BOARD_SIZE + col
        const base = (d * AREA + index) * 9
        for (let offset = -4; offset <= 4; offset += 1) {
          const nextRow = row + dr * offset
          const nextCol = col + dc * offset
          NBR9[base + offset + 4] =
            nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE
              ? nextRow * BOARD_SIZE + nextCol
              : -1
        }

        const ring: number[] = []
        for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
          for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
            if (rowOffset === 0 && colOffset === 0) continue
            const ringRow = row + rowOffset
            const ringCol = col + colOffset
            if (ringRow < 0 || ringRow >= BOARD_SIZE) continue
            if (ringCol < 0 || ringCol >= BOARD_SIZE) continue
            ring.push(ringRow * BOARD_SIZE + ringCol)
          }
        }
        RING2[index] = Int16Array.from(ring)
      }
    }

    // Collect maximal lines for this direction and index every point that is
    // part of a line with at least five cells.
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const previousRow = row - dr
        const previousCol = col - dc
        if (
          previousRow >= 0 &&
          previousRow < BOARD_SIZE &&
          previousCol >= 0 &&
          previousCol < BOARD_SIZE
        ) {
          continue
        }

        const cells: number[] = []
        let nextRow = row
        let nextCol = col
        while (
          nextRow >= 0 &&
          nextRow < BOARD_SIZE &&
          nextCol >= 0 &&
          nextCol < BOARD_SIZE
        ) {
          cells.push(nextRow * BOARD_SIZE + nextCol)
          nextRow += dr
          nextCol += dc
        }

        if (cells.length < 5) continue
        const lineId = LINE_CELLS.length
        LINE_CELLS.push(Int16Array.from(cells))
        for (const index of cells) {
          LINE_IDS[index * 4 + d] = lineId
        }
      }
    }
  }
})()

export interface MoveAnalysis {
  /** Position score after the hypothetical placement. */
  score: number
  /** The placement itself completes five or more. */
  five: boolean
  /**
   * Empty points that would complete five after this placement. Two distinct
   * points mean an open four, one point means a simple four.
   */
  finishPoints: number[]
  /** Number of clean three-in-five windows created by the placement. */
  threeWindows: number
}

export interface ScoredPoint {
  index: number
  attack: MoveAnalysis
  defense: MoveAnalysis
  score: number
}

/**
 * Mutable search position with incrementally maintained line scores.
 *
 * The public `board` is still authoritative for legality. Place/undo must be
 * paired; `history` keeps the move order so undo is O(1).
 */
export class Position {
  readonly board: Int8Array
  readonly history: number[] = []

  private readonly lineScoresBlack: Float64Array
  private readonly lineScoresWhite: Float64Array
  private totalBlack = 0
  private totalWhite = 0

  constructor(source: Board) {
    this.board = Int8Array.from(source)
    this.lineScoresBlack = new Float64Array(LINE_CELLS.length)
    this.lineScoresWhite = new Float64Array(LINE_CELLS.length)

    for (let lineId = 0; lineId < LINE_CELLS.length; lineId += 1) {
      const black = this.scoreLine(lineId, 1 as Stone)
      const white = this.scoreLine(lineId, 2 as Stone)
      this.lineScoresBlack[lineId] = black
      this.lineScoresWhite[lineId] = white
      this.totalBlack += black
      this.totalWhite += white
    }
  }

  get stoneCount(): number {
    return this.history.length === 0 ? this.countStones() : this.history.length
  }

  /** Flat point index -> stone colour. `EMPTY` for free points. */
  cell(index: number): number {
    return this.board[index] ?? EMPTY
  }

  place(index: number, stone: Stone): void {
    this.board[index] = stone
    this.history.push(index)
    this.refreshLines(index)
  }

  undo(): number | undefined {
    const index = this.history.pop()
    if (index === undefined) return undefined
    this.board[index] = EMPTY
    this.refreshLines(index)
    return index
  }

  hasFiveAt(index: number, stone: Stone): boolean {
    for (let d = 0; d < DIRECTIONS.length; d += 1) {
      const base = (d * AREA + index) * 9
      for (let window = 0; window < 5; window += 1) {
        let complete = true
        for (let offset = 0; offset < 5; offset += 1) {
          const cell = NBR9[base + window + offset]!
          if (cell < 0) {
            complete = false
            break
          }
          if (cell !== index && this.board[cell] !== stone) {
            complete = false
            break
          }
        }
        if (complete) return true
      }
    }
    return false
  }

  /**
   * Analyses a hypothetical placement. The target point must be empty; the
   * board is not mutated.
   */
  analyze(index: number, stone: Stone): MoveAnalysis {
    if (this.board[index] !== EMPTY) {
      return { score: -SEARCH_INFINITY, five: false, finishPoints: [], threeWindows: 0 }
    }

    let score = 0
    let five = false
    let threeWindows = 0
    const finishPoints: number[] = []

    for (let d = 0; d < DIRECTIONS.length; d += 1) {
      const base = (d * AREA + index) * 9
      for (let window = 0; window < 5; window += 1) {
        let own = 0
        let empty = 0
        let emptyPoint = -1
        let blocked = false

        for (let offset = 0; offset < 5; offset += 1) {
          const cell = NBR9[base + window + offset]!
          if (cell < 0) {
            blocked = true
            break
          }
          const value = cell === index ? stone : this.board[cell]!
          if (value === stone) {
            own += 1
          } else if (value === EMPTY) {
            empty += 1
            emptyPoint = cell
          } else {
            blocked = true
            break
          }
        }

        if (blocked) continue

        score += WINDOW_VALUE[own] ?? 0

        if (own === 5) {
          five = true
        } else if (own === 4 && empty === 1) {
          if (!finishPoints.includes(emptyPoint)) finishPoints.push(emptyPoint)
        } else if (own === 3 && empty === 2) {
          threeWindows += 1
        }
      }
    }

    if (five) {
      return { score: WIN_SCORE, five: true, finishPoints, threeWindows }
    }

    if (finishPoints.length >= 2) score += OPEN_FOUR_BONUS
    else if (finishPoints.length === 1) score += FOUR_BONUS
    if (threeWindows >= 2) score += OPEN_THREE_BONUS

    return { score, five: false, finishPoints, threeWindows }
  }

  /** Empty points within Chebyshev distance 2 of any stone. */
  candidateMoves(): number[] {
    const seen = new Uint8Array(AREA)
    const result: number[] = []
    let occupied = 0

    for (let index = 0; index < AREA; index += 1) {
      if (this.board[index] === EMPTY) continue
      occupied += 1
      const ring = RING2[index]!
      for (let i = 0; i < ring.length; i += 1) {
        const candidate = ring[i]!
        if (this.board[candidate] !== EMPTY || seen[candidate] === 1) continue
        seen[candidate] = 1
        result.push(candidate)
      }
    }

    if (result.length === 0) {
      if (occupied === 0) return [CENTER_INDEX]
      for (let index = 0; index < AREA; index += 1) {
        if (this.board[index] === EMPTY) result.push(index)
      }
    }

    return result
  }

  /** Static evaluation from the perspective of `stone` to move. */
  evaluate(stone: Stone): number {
    const own = stone === 1 ? this.totalBlack : this.totalWhite
    const opponent = stone === 1 ? this.totalWhite : this.totalBlack
    return own - opponent * 1.12 + 8
  }

  private countStones(): number {
    let count = 0
    for (let index = 0; index < AREA; index += 1) {
      if (this.board[index] !== EMPTY) count += 1
    }
    return count
  }

  private refreshLines(index: number): void {
    for (let d = 0; d < DIRECTIONS.length; d += 1) {
      const lineId = LINE_IDS[index * 4 + d]!
      if (lineId < 0) continue

      const previousBlack = this.lineScoresBlack[lineId]!
      const previousWhite = this.lineScoresWhite[lineId]!
      const nextBlack = this.scoreLine(lineId, 1 as Stone)
      const nextWhite = this.scoreLine(lineId, 2 as Stone)

      this.lineScoresBlack[lineId] = nextBlack
      this.lineScoresWhite[lineId] = nextWhite
      this.totalBlack += nextBlack - previousBlack
      this.totalWhite += nextWhite - previousWhite
    }
  }

  private scoreLine(lineId: number, stone: Stone): number {
    const cells = LINE_CELLS[lineId]!
    let five = false
    let firstEmpty = -1
    let secondEmpty = -1
    let threes = 0
    let twos = 0
    let ones = 0

    for (let start = 0; start <= cells.length - 5; start += 1) {
      let own = 0
      let empty = 0
      let emptyCell = -1
      let blocked = false

      for (let offset = 0; offset < 5; offset += 1) {
        const cell = cells[start + offset]!
        const value = this.board[cell]!
        if (value === stone) {
          own += 1
        } else if (value === EMPTY) {
          empty += 1
          emptyCell = cell
        } else {
          blocked = true
          break
        }
      }

      if (blocked) continue

      if (own === 5) {
        five = true
      } else if (own === 4 && empty === 1) {
        if (emptyCell !== firstEmpty && emptyCell !== secondEmpty) {
          if (firstEmpty < 0) firstEmpty = emptyCell
          else secondEmpty = emptyCell
        }
      } else if (own === 3 && empty === 2) {
        threes += 1
      } else if (own === 2 && empty === 3) {
        twos += 1
      } else if (own === 1 && empty === 4) {
        ones += 1
      }
    }

    if (five) return LINE_FIVE
    if (secondEmpty >= 0) return LINE_OPEN_FOUR
    if (firstEmpty >= 0) return LINE_FOUR
    if (threes >= 2) return LINE_OPEN_THREE
    if (threes === 1) return LINE_THREE
    if (twos >= 2) return LINE_OPEN_TWO
    if (twos === 1) return LINE_TWO
    return ones >= 1 ? LINE_ONE : 0
  }
}
