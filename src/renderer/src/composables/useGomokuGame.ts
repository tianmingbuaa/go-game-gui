import { computed, onScopeDispose, reactive, ref } from 'vue'
import type { AIChooseMovePayload, AIEngineInfo } from '@shared/ai'
import {
  BLACK,
  otherStone,
  type Board,
  type GameMode,
  type GamePhase,
  type Move,
  type Stone,
  type WinningLine
} from '@shared/game/types'
import {
  checkWinAt,
  createEmptyBoard,
  isBoardFull,
  isLegalMove,
  placeStone,
  toPosition
} from '@shared/game/rules'

export interface GameSettings {
  mode: GameMode
  humanStone: Stone
  engineId: string
  level: string
}

export interface GameResultView {
  tone: 'win' | 'lose' | 'draw'
  title: string
  subtitle: string
  seal: string
}

const AI_MIN_THINK_MS = 420

/**
 * Owns all gameplay state. The renderer stays deliberately thin around this
 * composable, making it straightforward to replace the board UI later.
 */
export function useGomokuGame() {
  const settings = reactive<GameSettings>({
    mode: 'ai',
    humanStone: BLACK,
    engineId: 'classic-heuristic',
    level: 'normal'
  })

  const engines = ref<AIEngineInfo[]>([])
  const enginesLoading = ref(true)
  const board = ref<Board>(createEmptyBoard())
  const history = ref<Move[]>([])
  const currentStone = ref<Stone>(BLACK)
  const phase = ref<GamePhase>('playing')
  const winningLine = ref<WinningLine | null>(null)
  const aiThinking = ref(false)
  const resultDismissed = ref(false)
  const errorMessage = ref('')
  const notice = ref('')
  const elapsedSeconds = ref(0)

  let aiToken = 0
  let startedAt = Date.now()
  let noticeTimer: ReturnType<typeof setTimeout> | undefined
  let clockTimer: ReturnType<typeof setInterval> | undefined

  const aiStone = computed(() => otherStone(settings.humanStone))
  const activeEngine = computed(() =>
    engines.value.find((engine) => engine.id === settings.engineId)
  )
  const activeLevel = computed(() =>
    activeEngine.value?.levels.find((level) => level.id === settings.level)
  )
  const isAI = computed(() => settings.mode === 'ai')
  const isGameOver = computed(() => phase.value !== 'playing')
  const moveCount = computed(() => history.value.length)
  const lastMove = computed<Move | null>(() => history.value.at(-1) ?? null)
  const winningCells = computed(() => new Set(winningLine.value?.cells ?? []))

  const isHumanTurn = computed(
    () =>
      isAI.value &&
      phase.value === 'playing' &&
      currentStone.value === settings.humanStone &&
      !aiThinking.value
  )

  const canInteract = computed(() => {
    if (phase.value !== 'playing') return false
    if (!isAI.value) return true
    return isHumanTurn.value
  })

  const canUndo = computed(() => {
    if (history.value.length === 0) return false
    if (!isAI.value) return true
    return history.value.some((move) => move.stone === settings.humanStone)
  })

  const currentStoneLabel = computed(() => (currentStone.value === BLACK ? '黑棋' : '白棋'))

  const statusText = computed(() => {
    if (phase.value === 'draw') return '本局和棋'
    if (phase.value === 'won') {
      const won = winningLine.value?.stone
      if (isAI.value) return won === settings.humanStone ? '你赢下了这一局' : 'AI 赢下了这一局'
      return `${won === BLACK ? '黑棋' : '白棋'}获胜`
    }
    if (isAI.value && aiThinking.value) return 'AI 正在推演'
    if (!isAI.value) return `轮到${currentStoneLabel.value}落子`
    return isHumanTurn.value ? '轮到你落子' : 'AI 准备落子'
  })

  const statusOverline = computed(() => {
    if (phase.value !== 'playing') return 'MATCH COMPLETE'
    if (isAI.value && aiThinking.value) return 'AI THINKING'
    if (!isAI.value) return `MOVE ${moveCount.value + 1}`
    return isHumanTurn.value ? 'YOUR TURN' : 'AI TURN'
  })

  const statusHint = computed(() => {
    if (phase.value === 'won') return '五子连珠，胜负已分'
    if (phase.value === 'draw') return '棋盘已满，未分胜负'
    if (errorMessage.value) return errorMessage.value
    if (isAI.value && aiThinking.value) return '引擎正在计算攻守要点，请稍候'
    return isAI.value ? '点击棋盘交叉点落子' : `点击交叉点，为${currentStoneLabel.value}落子`
  })

  const elapsedLabel = computed(() => {
    const minutes = Math.floor(elapsedSeconds.value / 60)
    const seconds = elapsedSeconds.value % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  const result = computed<GameResultView | null>(() => {
    if (phase.value === 'playing') return null
    if (phase.value === 'draw') {
      return {
        tone: 'draw',
        title: '势均力敌',
        subtitle: '棋盘已满，双方握手言和。',
        seal: '和'
      }
    }

    const won = winningLine.value?.stone
    if (!won) return null

    if (isAI.value) {
      const humanWon = won === settings.humanStone
      return {
        tone: humanWon ? 'win' : 'lose',
        title: humanWon ? '漂亮的五连' : '棋差一着',
        subtitle: humanWon ? '你在与 AI 的对弈中拿下此局。' : '再想一步，下一局扳回来。',
        seal: humanWon ? '胜' : '负'
      }
    }

    return {
      tone: 'win',
      title: `${won === BLACK ? '黑棋' : '白棋'}胜出`,
      subtitle: '五子连珠，本局胜负已分。',
      seal: '胜'
    }
  })

  const resultVisible = computed(() => result.value !== null && !resultDismissed.value)

  const modeLabel = computed(() => (isAI.value ? '人机对战' : '双人对弈'))

  void loadEngines()
  clockTimer = setInterval(() => {
    if (phase.value === 'playing') syncElapsed()
  }, 500)

  onScopeDispose(() => {
    if (clockTimer) clearInterval(clockTimer)
    if (noticeTimer) clearTimeout(noticeTimer)
    aiToken += 1
  })

  async function loadEngines(): Promise<void> {
    enginesLoading.value = true
    try {
      const list = await window.gomoku.ai.listEngines()
      engines.value = list
      if (!list.some((engine) => engine.id === settings.engineId) && list[0]) {
        settings.engineId = list[0].id
      }
      const engine = list.find((candidate) => candidate.id === settings.engineId)
      if (engine && !engine.levels.some((level) => level.id === settings.level)) {
        settings.level = engine.levels[0]?.id ?? 'normal'
      }
      if (
        isAI.value &&
        phase.value === 'playing' &&
        currentStone.value === aiStone.value &&
        !aiThinking.value
      ) {
        void requestAIMove()
      }
    } catch (error) {
      errorMessage.value = toErrorMessage(error, '无法加载 AI 引擎')
    } finally {
      enginesLoading.value = false
    }
  }

  function setMode(mode: GameMode): void {
    if (settings.mode === mode) return
    settings.mode = mode
    newGame(mode === 'ai' ? '已切换为人机对战' : '已切换为双人对弈')
  }

  function setHumanStone(stone: Stone): void {
    if (settings.humanStone === stone) return
    settings.humanStone = stone
    newGame(stone === BLACK ? '你执黑先行' : '你执白，AI 先行')
  }

  function setEngine(engineId: string): void {
    if (settings.engineId === engineId) return
    const engine = engines.value.find((candidate) => candidate.id === engineId)
    if (!engine) return
    settings.engineId = engine.id
    if (!engine.levels.some((level) => level.id === settings.level)) {
      settings.level = engine.levels[0]?.id ?? 'normal'
    }
    newGame(`AI 引擎已切换为 ${engine.name}`)
  }

  function setLevel(levelId: string): void {
    if (settings.level === levelId) return
    const level = activeEngine.value?.levels.find((candidate) => candidate.id === levelId)
    if (!level) return
    settings.level = level.id
    newGame(`AI 难度已设为 ${level.name}`)
  }

  function play(index: number): void {
    if (!canInteract.value) return
    const stone = isAI.value ? settings.humanStone : currentStone.value
    commitMove(index, stone)
  }

  function commitMove(index: number, stone: Stone): void {
    if (phase.value !== 'playing' || !isLegalMove(board.value, index) || stone !== currentStone.value) {
      return
    }

    const nextBoard = placeStone(board.value, index, stone)
    const { row, col } = toPosition(index)
    const move: Move = {
      index,
      row,
      col,
      stone,
      number: history.value.length + 1
    }

    board.value = nextBoard
    history.value = [...history.value, move]
    errorMessage.value = ''

    const win = checkWinAt(nextBoard, index)
    if (win) {
      winningLine.value = win
      phase.value = 'won'
      resultDismissed.value = false
      aiThinking.value = false
      aiToken += 1
      syncElapsed()
      return
    }

    if (isBoardFull(nextBoard)) {
      phase.value = 'draw'
      resultDismissed.value = false
      aiThinking.value = false
      aiToken += 1
      syncElapsed()
      return
    }

    currentStone.value = otherStone(stone)

    if (isAI.value && currentStone.value === aiStone.value) {
      void requestAIMove()
    }
  }

  async function requestAIMove(): Promise<void> {
    if (!isAI.value || phase.value !== 'playing' || currentStone.value !== aiStone.value) return
    if (aiThinking.value) return

    if (!activeEngine.value) {
      errorMessage.value = enginesLoading.value ? 'AI 引擎正在加载，请稍候' : '没有可用的 AI 引擎'
      return
    }

    const token = ++aiToken
    aiThinking.value = true
    errorMessage.value = ''

    // IPC uses the structured clone algorithm, which cannot serialize Vue's
    // reactive proxies. Send a plain snapshot of the position.
    const payload: AIChooseMovePayload = {
      engineId: settings.engineId,
      board: [...board.value],
      aiStone: aiStone.value,
      opponentStone: settings.humanStone,
      history: history.value.map((move) => ({ ...move })),
      level: settings.level
    }

    try {
      const [response] = await Promise.all([
        window.gomoku.ai.chooseMove(payload),
        wait(AI_MIN_THINK_MS)
      ])

      if (token !== aiToken || phase.value !== 'playing') return

      if (!response.ok) {
        errorMessage.value = response.error
        return
      }

      aiThinking.value = false
      commitMove(response.move.index, aiStone.value)
    } catch (error) {
      if (token !== aiToken) return
      errorMessage.value = toErrorMessage(error, 'AI 思考失败')
    } finally {
      if (token === aiToken) aiThinking.value = false
    }
  }

  function retryAI(): void {
    if (phase.value !== 'playing' || !isAI.value) return
    errorMessage.value = ''
    aiThinking.value = false
    void requestAIMove()
  }

  function undo(): void {
    if (!canUndo.value || history.value.length === 0) return

    aiToken += 1
    aiThinking.value = false
    errorMessage.value = ''

    const remaining = history.value.slice()

    if (isAI.value) {
      const last = remaining.at(-1)
      if (last?.stone === aiStone.value) {
        remaining.pop()
        if (remaining.at(-1)?.stone === settings.humanStone) remaining.pop()
      } else {
        remaining.pop()
      }
    } else {
      remaining.pop()
    }

    let rebuilt = createEmptyBoard()
    for (const move of remaining) {
      rebuilt = placeStone(rebuilt, move.index, move.stone)
    }

    history.value = remaining
    board.value = rebuilt
    phase.value = 'playing'
    winningLine.value = null
    resultDismissed.value = false
    const last = remaining.at(-1)
    currentStone.value = last ? otherStone(last.stone) : BLACK

    notify('已悔棋')
    if (isAI.value && currentStone.value === aiStone.value) {
      void requestAIMove()
    }
  }

  function newGame(message?: string): void {
    aiToken += 1
    board.value = createEmptyBoard()
    history.value = []
    currentStone.value = BLACK
    phase.value = 'playing'
    winningLine.value = null
    aiThinking.value = false
    resultDismissed.value = false
    errorMessage.value = ''
    startedAt = Date.now()
    elapsedSeconds.value = 0

    if (message) notify(message)
    if (isAI.value && currentStone.value === aiStone.value) {
      void requestAIMove()
    }
  }

  function restart(): void {
    newGame('新的一局，落子有声')
  }

  function dismissResult(): void {
    resultDismissed.value = true
  }

  function syncElapsed(): void {
    elapsedSeconds.value = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  }

  function notify(message: string): void {
    notice.value = message
    if (noticeTimer) clearTimeout(noticeTimer)
    noticeTimer = setTimeout(() => {
      notice.value = ''
    }, 2600)
  }

  return {
    settings,
    engines,
    enginesLoading,
    board,
    history,
    currentStone,
    phase,
    winningLine,
    winningCells,
    aiThinking,
    errorMessage,
    notice,
    result,
    resultVisible,
    activeEngine,
    activeLevel,
    aiStone,
    isAI,
    isGameOver,
    isHumanTurn,
    canInteract,
    canUndo,
    moveCount,
    lastMove,
    statusText,
    statusOverline,
    statusHint,
    elapsedLabel,
    modeLabel,
    setMode,
    setHumanStone,
    setEngine,
    setLevel,
    play,
    undo,
    restart,
    dismissResult,
    retryAI
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  return fallback
}
