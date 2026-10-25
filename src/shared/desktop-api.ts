import type { AIChooseMovePayload, AIChooseMoveResult, AIEngineInfo } from './ai'

/** The typed surface exposed by the preload bridge at `window.gomoku`. */
export interface GomokuDesktopApi {
  ai: {
    listEngines(): Promise<AIEngineInfo[]>
    chooseMove(payload: AIChooseMovePayload): Promise<AIChooseMoveResult>
  }
  window: {
    minimize(): Promise<void>
    toggleMaximize(): Promise<boolean>
    close(): Promise<void>
    isMaximized(): Promise<boolean>
    onMaximizedChange(listener: (maximized: boolean) => void): () => void
  }
}
