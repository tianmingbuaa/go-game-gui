import { ipcMain } from 'electron'
import type {
  AIChooseMovePayload,
  AIChooseMoveResult,
  AIEngineRegistry
} from '../../shared/ai'
import { isBoard, isLegalMove } from '../../shared/game/rules'
import { BLACK, BOARD_SIZE, WHITE, type Move } from '../../shared/game/types'
import { IPC_CHANNELS } from '../../shared/ipc'

const AI_TIMEOUT_MS = 8_000

/** Registers AI IPC endpoints. The registry is the only extension point needed. */
export function registerAIIpc(registry: AIEngineRegistry): void {
  ipcMain.handle(IPC_CHANNELS.aiListEngines, () => registry.list())

  ipcMain.handle(
    IPC_CHANNELS.aiChooseMove,
    async (_event, rawPayload: unknown): Promise<AIChooseMoveResult> => {
      const startedAt = performance.now()

      try {
        const payload = parsePayload(rawPayload)
        const engine = registry.get(payload.engineId)
        if (!engine) {
          return { ok: false, error: `未找到 AI 引擎：${payload.engineId}` }
        }
        if (!engine.info.levels.some((level) => level.id === payload.level)) {
          return { ok: false, error: `不支持的 AI 难度：${payload.level}` }
        }

        const controller = new AbortController()
        let timer: NodeJS.Timeout | undefined
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('AI 思考超时，请重试'))
          }, AI_TIMEOUT_MS)
        })

        try {
          const move = await Promise.race([
            engine.chooseMove(
              {
                board: payload.board,
                aiStone: payload.aiStone,
                opponentStone: payload.opponentStone,
                history: payload.history,
                level: payload.level
              },
              controller.signal
            ),
            timeout
          ])

          if (!move || !isLegalMove(payload.board, move.index)) {
            return { ok: false, error: 'AI 返回了无效的落子位置' }
          }

          return {
            ok: true,
            engineId: payload.engineId,
            move,
            elapsedMs: Math.round((performance.now() - startedAt) * 10) / 10
          }
        } finally {
          if (timer) clearTimeout(timer)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI 思考失败'
        console.error('[ai] choose move failed:', error)
        return { ok: false, error: message }
      }
    }
  )
}

function parsePayload(raw: unknown): AIChooseMovePayload {
  if (!isRecord(raw)) throw new Error('AI 请求格式无效')

  const { engineId, board, aiStone, opponentStone, history, level } = raw

  if (typeof engineId !== 'string' || !engineId) throw new Error('AI 引擎 ID 无效')
  if (!isBoard(board)) throw new Error('棋盘数据无效')
  if (aiStone !== BLACK && aiStone !== WHITE) throw new Error('AI 棋色无效')
  if (opponentStone !== BLACK && opponentStone !== WHITE) throw new Error('对手棋色无效')
  if (aiStone === opponentStone) throw new Error('AI 与对手不能使用相同棋色')
  if (typeof level !== 'string' || !level) throw new Error('AI 难度无效')
  if (!Array.isArray(history)) throw new Error('棋谱数据无效')
  if (history.some((move) => !isMove(move))) throw new Error('棋谱中存在无效记录')

  return {
    engineId,
    board,
    aiStone,
    opponentStone,
    history: history as Move[],
    level
  }
}

function isMove(value: unknown): value is Move {
  if (!isRecord(value)) return false
  const { index, row, col, stone, number } = value
  if (typeof index !== 'number' || !Number.isInteger(index)) return false
  if (index < 0 || index >= BOARD_SIZE * BOARD_SIZE) return false
  if (typeof row !== 'number' || !Number.isInteger(row)) return false
  if (row < 0 || row >= BOARD_SIZE) return false
  if (typeof col !== 'number' || !Number.isInteger(col)) return false
  if (col < 0 || col >= BOARD_SIZE) return false
  if (index !== row * BOARD_SIZE + col) return false
  if (stone !== BLACK && stone !== WHITE) return false
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) return false
  return true
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
