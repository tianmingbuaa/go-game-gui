import { otherStone, type Stone } from '../../../../shared/game/types'
import { Position, type MoveAnalysis } from './position'

export interface VcfOptions {
  /** Maximum number of attacker moves in the forcing sequence. */
  maxDepth: number
  /** Absolute timestamp (performance.now()) after which the search stops. */
  deadline: number
  signal?: AbortSignal
  /** Hard node budget used to keep pathological positions bounded. */
  maxNodes?: number
}

interface FourCandidate {
  index: number
  analysis: MoveAnalysis
  open: boolean
}

class VcfTimeout extends Error {}

/**
 * Victory by Continuous Fours.
 *
 * A sound forcing search: the attacker only plays moves that create a four
 * (or an immediate five), so the defender's reply is a single forced block.
 * Any defender immediate win invalidates the attacker's four, because the
 * defender would simply win instead of blocking. That rule also handles the
 * usual "counter-four" trap of naive VCT searches.
 *
 * Returns the attacker's moves, or `null` when no forced four chain exists
 * within the budget. The defender's replies are implicit (always the unique
 * completion point of the four).
 */
export function findVcf(
  position: Position,
  attacker: Stone,
  options: VcfOptions
): number[] | null {
  const defender = otherStone(attacker)
  const path: number[] = []
  const maxNodes = options.maxNodes ?? 40_000
  let nodes = 0

  const defenderHasImmediateWin = (): boolean => {
    const candidates = position.candidateMoves()
    for (const index of candidates) {
      if (position.analyze(index, defender).five) return true
    }
    return false
  }

  const search = (depth: number): boolean => {
    nodes += 1
    if (nodes > maxNodes) throw new VcfTimeout('vcf node budget')
    if (nodes % 256 === 0) {
      if (options.signal?.aborted) throw new VcfTimeout('aborted')
      if (performance.now() > options.deadline) throw new VcfTimeout('vcf deadline')
    }
    if (depth <= 0) return false

    const candidates = position.candidateMoves()
    const fours: FourCandidate[] = []
    let winningMove = -1

    for (const index of candidates) {
      const analysis = position.analyze(index, attacker)
      if (analysis.five) {
        winningMove = index
        break
      }
      if (analysis.finishPoints.length === 0) continue
      fours.push({
        index,
        analysis,
        open: analysis.finishPoints.length >= 2
      })
    }

    if (winningMove >= 0) {
      path.push(winningMove)
      return true
    }

    fours.sort((a, b) => {
      if (a.open !== b.open) return a.open ? -1 : 1
      return b.analysis.score - a.analysis.score
    })

    for (const four of fours) {
      position.place(four.index, attacker)

      // If the defender can complete five on their turn, this four is not
      // forcing at all: they win immediately instead of blocking.
      if (defenderHasImmediateWin()) {
        position.undo()
        continue
      }

      if (four.open) {
        // Two distinct completion points: the defender cannot cover both, so
        // the attacker wins on the next move.
        path.push(four.index)
        return true
      }

      const blockPoint = four.analysis.finishPoints[0]
      if (blockPoint === undefined) {
        position.undo()
        continue
      }

      position.place(blockPoint, defender)

      path.push(four.index)
      const won = search(depth - 1)
      if (won) return true
      path.pop()

      position.undo()
      position.undo()
    }

    return false
  }

  const baseHistoryLength = position.history.length
  try {
    return search(options.maxDepth) ? path : null
  } catch (error) {
    if (error instanceof VcfTimeout) return null
    throw error
  } finally {
    // VCF explores on the live position; leave it exactly as it was found so
    // the caller can continue with a clean board.
    while (position.history.length > baseHistoryLength) position.undo()
  }
}
