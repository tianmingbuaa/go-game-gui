<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const maximized = ref(false)
let unsubscribe: (() => void) | undefined

onMounted(async () => {
  try {
    maximized.value = await window.gomoku.window.isMaximized()
    unsubscribe = window.gomoku.window.onMaximizedChange((value) => {
      maximized.value = value
    })
  } catch (error) {
    console.error('Window state unavailable', error)
  }
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

async function minimize(): Promise<void> {
  await window.gomoku.window.minimize()
}

async function toggleMaximize(): Promise<void> {
  maximized.value = await window.gomoku.window.toggleMaximize()
}

async function close(): Promise<void> {
  await window.gomoku.window.close()
}
</script>

<template>
  <header class="titlebar">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28">
          <defs>
            <linearGradient id="mo-tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#8b93fb" />
              <stop offset="1" stop-color="#5b5fe0" />
            </linearGradient>
          </defs>
          <rect x="0.5" y="0.5" width="27" height="27" rx="8" fill="url(#mo-tile)" />
          <path d="M9 5.5v17M14 5.5v17M19 5.5v17M5.5 9h17M5.5 14h17M5.5 19h17" stroke="#fff" stroke-opacity=".22" stroke-width=".9" />
          <circle cx="14" cy="14" r="4.4" fill="#fff" />
          <circle cx="12.5" cy="12.5" r="1.3" fill="#fff" opacity=".95" />
        </svg>
      </span>
      <span class="brand-copy">
        <span class="brand-title">墨弈</span>
        <span class="brand-subtitle">Gomoku</span>
      </span>
    </div>

    <div class="titlebar-center">
      <span>15 × 15</span>
      <span class="dot"></span>
      <span>无禁手</span>
    </div>

    <div class="titlebar-right">
      <span class="offline-chip"><i></i>本地对局</span>
      <div class="window-controls">
        <button class="window-button" type="button" aria-label="最小化" title="最小化" @click="minimize">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 6h6" /></svg>
        </button>
        <button
          class="window-button"
          type="button"
          :aria-label="maximized ? '还原窗口' : '最大化'"
          :title="maximized ? '还原窗口' : '最大化'"
          @click="toggleMaximize"
        >
          <svg v-if="!maximized" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2.75" y="2.75" width="6.5" height="6.5" rx="1.6" />
          </svg>
          <svg v-else viewBox="0 0 12 12" aria-hidden="true">
            <rect x="2.75" y="4" width="5.25" height="5.25" rx="1.4" />
            <path d="M4.75 4V2.75h4.5V7.25H8.9" />
          </svg>
        </button>
        <button class="window-button close" type="button" aria-label="关闭窗口" title="关闭" @click="close">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3.5 3.5 5 5m0-5-5 5" /></svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.titlebar {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 0 0 56px;
  height: 56px;
  padding: 0 10px 0 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(12, 13, 16, 0.72);
  backdrop-filter: blur(20px);
  -webkit-app-region: drag;
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 126px;
}

.brand-mark {
  width: 28px;
  height: 28px;
}

.brand-mark svg {
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 10px rgba(99, 102, 241, 0.35));
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.brand-title {
  color: var(--text);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.brand-subtitle {
  color: var(--faint);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.titlebar-center {
  position: absolute;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.02);
  transform: translateX(-50%);
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

.dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--faint);
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.offline-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 500;
}

.offline-chip i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.16);
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  -webkit-app-region: no-drag;
}

.window-button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: background-color 150ms ease, color 150ms ease;
}

.window-button svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.window-button:hover {
  background: var(--bg-hover);
  color: var(--text);
}

.window-button.close:hover {
  background: #ef4444;
  color: #fff;
}

@media (max-width: 1140px) {
  .titlebar-center,
  .offline-chip {
    display: none;
  }
}
</style>
