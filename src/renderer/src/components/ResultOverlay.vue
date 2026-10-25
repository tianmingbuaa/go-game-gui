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
  border-radius: 19px;
  background: rgba(6, 9, 15, 0.52);
  backdrop-filter: blur(7px) saturate(0.9);
}

.result-card {
  position: relative;
  width: min(352px, 92%);
  padding: 28px 30px 25px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 22px;
  background:
    radial-gradient(120% 100% at 50% -15%, rgba(229, 181, 110, 0.13), transparent 58%),
    linear-gradient(158deg, rgba(25, 31, 43, 0.98), rgba(10, 14, 22, 0.97));
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  text-align: center;
}

.result-card::before {
  content: '';
  position: absolute;
  inset: 8px;
  border: 1px solid rgba(230, 184, 117, 0.09);
  border-radius: 16px;
  pointer-events: none;
}

.result-card.lose {
  background:
    radial-gradient(120% 100% at 50% -15%, rgba(111, 168, 180, 0.1), transparent 58%),
    linear-gradient(158deg, rgba(21, 29, 39, 0.98), rgba(9, 13, 20, 0.97));
}

.result-kicker {
  position: relative;
  display: block;
  margin-bottom: 18px;
  color: rgba(203, 178, 139, 0.55);
  font-size: 8.5px;
  font-weight: 650;
  letter-spacing: 0.24em;
}

.result-seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 66px;
  height: 66px;
  margin: 0 auto 17px;
  border: 1px solid rgba(232, 188, 121, 0.48);
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 28%, rgba(255, 231, 187, 0.14), transparent 58%),
    rgba(230, 179, 109, 0.035);
  box-shadow:
    0 0 0 5px rgba(230, 179, 109, 0.035),
    0 0 30px rgba(230, 179, 109, 0.1);
  color: #e9c994;
  font-family: var(--font-display);
  font-size: 27px;
  font-weight: 500;
}

.result-seal::after {
  content: '';
  position: absolute;
  inset: 5px;
  border: 1px dashed rgba(232, 188, 121, 0.25);
  border-radius: 50%;
}

.result-seal.draw {
  border-color: rgba(160, 185, 201, 0.4);
  color: #c2d5df;
  box-shadow: 0 0 30px rgba(117, 166, 190, 0.08);
}

.result-seal.lose {
  border-color: rgba(129, 175, 190, 0.4);
  color: #a9ceda;
  background: rgba(121, 174, 191, 0.04);
  box-shadow: 0 0 30px rgba(100, 160, 180, 0.08);
}

h2 {
  position: relative;
  margin: 0;
  color: #f5eee2;
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.result-card > p {
  position: relative;
  margin: 9px auto 0;
  max-width: 260px;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.75;
}

.result-stats {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: 20px 0 22px;
  color: var(--faint);
  font-size: 9.5px;
}

.result-stats strong {
  color: #d8cbb7;
  font-size: 11px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.result-stats i {
  width: 1px;
  height: 11px;
  background: rgba(255, 255, 255, 0.1);
}

.result-actions {
  position: relative;
  display: grid;
  gap: 8px;
}

.result-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  border: 1px solid rgba(255, 224, 175, 0.5);
  border-radius: 11px;
  background: linear-gradient(180deg, #efc887, #dba75e);
  color: #24170a;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25), inset 0 1px rgba(255, 255, 255, 0.4);
  transition: filter 160ms ease, transform 160ms ease;
}

.result-primary svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.result-primary:hover {
  filter: brightness(1.05);
  transform: translateY(-1px);
}

.result-secondary {
  height: 34px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--faint);
  font-size: 10.5px;
  cursor: pointer;
  transition: color 160ms ease, background 160ms ease;
}

.result-secondary:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
}
</style>
