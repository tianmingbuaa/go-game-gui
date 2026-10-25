import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { createAIRegistry } from './ai/registry'
import { registerAIIpc } from './ai/ipc'
import { IPC_CHANNELS } from '../shared/ipc'

let mainWindow: BrowserWindow | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('com.moyi.gomoku')
    Menu.setApplicationMenu(null)

    const registry = createAIRegistry()
    registerAIIpc(registry)
    registerWindowIpc()

    mainWindow = createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 700,
    show: false,
    frame: false,
    backgroundColor: '#080b12',
    title: '墨弈五子棋',
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
      spellcheck: false
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.on('maximize', () => {
    window.webContents.send(IPC_CHANNELS.windowMaximizedChanged, true)
  })

  window.on('unmaximize', () => {
    window.webContents.send(IPC_CHANNELS.windowMaximizedChanged, false)
  })

  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const currentUrl = window.webContents.getURL()
    if (url !== currentUrl) event.preventDefault()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function registerWindowIpc(): void {
  ipcMain.handle(IPC_CHANNELS.windowMinimize, (event) => {
    const window = windowFrom(event)
    window?.minimize()
  })

  ipcMain.handle(IPC_CHANNELS.windowToggleMaximize, (event) => {
    const window = windowFrom(event)
    if (!window) return false
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
    return window.isMaximized()
  })

  ipcMain.handle(IPC_CHANNELS.windowClose, (event) => {
    windowFrom(event)?.close()
  })

  ipcMain.handle(IPC_CHANNELS.windowIsMaximized, (event) => {
    return windowFrom(event)?.isMaximized() ?? false
  })
}

function windowFrom(event: IpcMainInvokeEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender)
}
