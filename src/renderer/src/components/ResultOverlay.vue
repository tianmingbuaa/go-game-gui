<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { GameResultView } from '../composables/useGomokuGame'

defineProps<{
  result: GameResultView
  moveCount: number
  elapsed: string
}>()

const emit = defineEmits<{
  restart: []
  dismiss: []
}>()

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('dismiss')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="result-overlay" role="dialog" aria-modal="true" aria-labelledby="result-title" @click.self="emit('dismiss')">
    <div class="result-card" :class="result.tone">
      <span class="result-kicker">{{ result.tone === 'draw' ? 'DRAW' : 'MATCH COMPLETE' }}</span>

      <div class="result-seal" :class="result.tone">
        <span>{{ result.seal }}</span>
      </div>

      <h2 id="result-title">{{ result.title }}</h2>
      <p>{{ result.subtitle }}</p>

      <div class="result-stats">
        <span><strong>{{ moveCount }}</strong> 手</span>
        <i></i>
        <span><strong>{{ elapsed }}</strong> 用时</span>
      </div>

      <div class="result-actions">
        <button class="result-primary" type="button" autofocus @click="emit('restart')">
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M14 6.5A5.5 5.5 0 1 0 14.5 11M14 3v3.7h-3.7" />
          </svg>
          再来一局
        </button>
        <button class="result-secondary" type="button" @click="emit('dismiss')">
          留在棋盘
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-overlay {
  position: absolute;
  inset: 10px;
  z-index: 10;
  display: grid;
  place-items: center;
  padding: 24px;
  border-radius: 18px;
  background: rgba(10, 11, 14, 0.34);
  backdrop-filter: blur(3px) saturate(0.92);
}

.result-card {
  width: min(348px, 92%);
  padding: 26px 26px 20px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xl);
  background: #17181d;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.06) inset,
    0 30px 70px -24px rgba(0, 0, 0, 0.85);
  text-align: center;
}

.result-kicker {
  display: block;
  margin-bottom: 16px;
  color: var(--faint);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.16em;
}

.result-seal {
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-size: 27px;
  font-weight: 600;
  box-shadow: 0 0 0 1px var(--accent-line) inset;
}

.result-seal.lose {
  background: rgba(255, 255, 255, 0.05);
  color: var(--muted);
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

.result-seal.draw {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-soft);
  box-shadow: 0 0 0 1px var(--line-strong) inset;
}

h2 {
  margin: 0;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.result-card > p {
  max-width: 260px;
  margin: 8px auto 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.result-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 18px 0 20px;
  color: var(--faint);
  font-size: 11px;
}

.result-stats strong {
  color: var(--text-soft);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.result-stats i {
  width: 1px;
  height: 12px;
  background: var(--line);
}

.result-actions {
  display: grid;
  gap: 6px;
}

.result-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: var(--accent-strong);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.18) inset,
    0 8px 20px -8px rgba(99, 102, 241, 0.9);
  transition: background-color 160ms ease, transform 120ms ease;
}

.result-primary svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.result-primary:hover {
  background: #7477f5;
}

.result-primary:active {
  transform: translateY(1px);
}

.result-secondary {
  height: 34px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.result-secondary:hover {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
