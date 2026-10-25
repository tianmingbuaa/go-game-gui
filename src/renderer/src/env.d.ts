import type { GomokuDesktopApi } from '@shared/desktop-api'

declare global {
  interface Window {
    gomoku: GomokuDesktopApi
  }
}

export {}
