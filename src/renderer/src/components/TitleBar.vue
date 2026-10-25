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
        <svg viewBox="0 0 34 34">
          <defs>
            <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#26301f" />
              <stop offset="1" stop-color="#10150f" />
            </linearGradient>
            <radialGradient id="brand-stone" cx="32%" cy="24%" r="78%">
              <stop offset="0" stop-color="#fffdf7" />
              <stop offset="0.58" stop-color="#ddd3c0" />
              <stop offset="1" stop-color="#9c8f78" />
            </radialGradient>
          </defs>
          <rect x="1" y="1" width="32" height="32" rx="10" fill="url(#tile)" stroke="#d3a766" stroke-opacity=".42" />
          <path d="M8 12h18M8 17h18M8 22h18M12 8v18M17 8v18M22 8v18" stroke="#e4bd82" stroke-opacity=".2" stroke-width=".8" />
          <circle cx="17" cy="17" r="6.6" fill="url(#brand-stone)" />
          <circle cx="14.7" cy="14.6" r="1.6" fill="#fff" opacity=".8" />
        </svg>
      </span>
      <span class="brand-copy">
        <span class="brand-title">墨弈</span>
        <span class="brand-subtitle">GOMOKU</span>
      </span>
    </div>

    <div class="titlebar-center">
      <span class="titlebar-rule"></span>
      <span>15 × 15 · 无禁手</span>
      <span class="titlebar-rule"></span>
    </div>

    <div class="titlebar-right">
      <span class="offline-chip"><i></i>LOCAL PLAY</span>
      <div class="window-controls">
        <button class="window-button" type="button" aria-label="最小化" title="最小化" @click="minimize">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 6.5h6" /></svg>
        </button>
        <button
          class="window-button"
          type="button"
          :aria-label="maximized ? '还原窗口' : '最大化'"
          :title="maximized ? '还原窗口' : '最大化'"
          @click="toggleMaximize"
        >
          <svg v-if="!maximized" viewBox="0 0 12 12" aria-hidden="true">
            <rect x="3" y="3" width="6" height="6" rx="1" />
          </svg>
          <svg v-else viewBox="0 0 12 12" aria-hidden="true">
            <rect x="3" y="4.2" width="4.8" height="4.8" rx="0.8" />
            <path d="M5 4.2V3h4v4H8" />
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
  flex: 0 0 54px;
  height: 54px;
  padding: 0 10px 0 22px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.055);
  background: linear-gradient(180deg, rgba(10, 14, 22, 0.9), rgba(8, 11, 18, 0.64));
  backdrop-filter: blur(22px);
  -webkit-app-region: drag;
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 126px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  filter: drop-shadow(0 5px 10px rgba(0, 0, 0, 0.35));
}

.brand-mark svg {
  display: block;
  width: 100%;
  height: 100%;
}

.brand-copy {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.brand-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #f3eadb;
}

.brand-subtitle {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.26em;
  color: rgba(198, 169, 126, 0.72);
}

.titlebar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(169, 176, 192, 0.54);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.2em;
  white-space: nowrap;
}

.titlebar-rule {
  width: 22px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(211, 177, 121, 0.38));
}

.titlebar-rule:last-child {
  background: linear-gradient(90deg, rgba(211, 177, 121, 0.38), transparent);
}

.titlebar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.offline-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid rgba(118, 189, 161, 0.15);
  border-radius: 999px;
  background: rgba(96, 166, 139, 0.045);
  color: rgba(158, 196, 179, 0.7);
  font-size: 8px;
  font-weight: 650;
  letter-spacing: 0.14em;
}

.offline-chip i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #76c3a3;
  box-shadow: 0 0 7px rgba(118, 195, 163, 0.7);
}

.window-controls {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.window-button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: rgba(219, 226, 239, 0.58);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.window-button svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.window-button:hover {
  background: rgba(255, 255, 255, 0.075);
  color: #f6f0e4;
}

.window-button.close:hover {
  background: #c24747;
  color: #fff;
}

@media (max-width: 1140px) {
  .titlebar-center,
  .offline-chip {
    display: none;
  }
}
</style>
