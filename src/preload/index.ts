import { contextBridge, ipcRenderer } from 'electron'
import type { AIChooseMovePayload } from '../shared/ai'
import type { GomokuDesktopApi } from '../shared/desktop-api'
import { IPC_CHANNELS } from '../shared/ipc'

const api: GomokuDesktopApi = {
  ai: {
    listEngines: () => ipcRenderer.invoke(IPC_CHANNELS.aiListEngines),
    chooseMove: (payload: AIChooseMovePayload) =>
      ipcRenderer.invoke(IPC_CHANNELS.aiChooseMove, payload)
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
    toggleMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowToggleMaximize),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized),
    onMaximizedChange: (listener: (maximized: boolean) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, maximized: boolean): void => {
        listener(maximized)
      }
      ipcRenderer.on(IPC_CHANNELS.windowMaximizedChanged, handler)
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.windowMaximizedChanged, handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('gomoku', api)
