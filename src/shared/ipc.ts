/** IPC channel names shared by the main process and preload bridge. */
export const IPC_CHANNELS = {
  aiListEngines: 'ai:list-engines',
  aiChooseMove: 'ai:choose-move',
  windowMinimize: 'window:minimize',
  windowToggleMaximize: 'window:toggle-maximize',
  windowClose: 'window:close',
  windowIsMaximized: 'window:is-maximized',
  windowMaximizedChanged: 'window:maximized-changed'
} as const
