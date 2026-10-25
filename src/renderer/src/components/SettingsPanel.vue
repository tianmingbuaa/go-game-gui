<script setup lang="ts">
import { computed } from 'vue'
import type { AIEngineInfo } from '@shared/ai'
import type { GameMode } from '@shared/game/types'

const props = defineProps<{
  mode: GameMode
  engineId: string
  level: string
  engines: readonly AIEngineInfo[]
  activeEngine: AIEngineInfo | undefined
  loading: boolean
}>()

const emit = defineEmits<{
  'update:mode': [mode: GameMode]
  'update:engine-id': [engineId: string]
  'update:level': [level: string]
}>()

const activeLevel = computed(() =>
  props.activeEngine?.levels.find((level) => level.id === props.level)
)

function onEngineChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value) emit('update:engine-id', value)
}
</script>

<template>
  <section class="settings-panel panel" aria-label="对局设置">
    <div class="panel-heading">
      <div>
        <span class="card-kicker">MATCH SETUP</span>
        <h1>对局设置</h1>
      </div>
      <span class="mode-chip" :class="{ ai: mode === 'ai' }">
        <i></i>{{ mode === 'ai' ? '人机对弈 · AI 先行' : '双人对弈' }}
      </span>
    </div>

    <div class="field">
      <span class="field-label">对战模式</span>
      <div class="segmented mode-segment" role="group" aria-label="对战模式">
        <button
          type="button"
          :class="{ selected: mode === 'ai' }"
          @click="emit('update:mode', 'ai')"
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M6.5 4.2v2.6M11.5 4.2v2.6M4 6.8h10v3.2a5 5 0 0 1-10 0V6.8ZM7 14v1.5m4-1.5v1.5" />
          </svg>
          人机对战
        </button>
        <button
          type="button"
          :class="{ selected: mode === 'local' }"
          @click="emit('update:mode', 'local')"
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <circle cx="6.3" cy="6" r="2.1" />
            <circle cx="11.7" cy="6" r="2.1" />
            <path d="M2.8 14c.3-2.3 1.6-3.6 3.5-3.6s3.2 1.3 3.5 3.6M8.3 14c.3-2.3 1.6-3.6 3.4-3.6 1.9 0 3.2 1.3 3.5 3.6" />
          </svg>
          双人对弈
        </button>
      </div>
    </div>

    <template v-if="mode === 'ai'">
      <div class="field">
        <span class="field-label">开局阵型</span>
        <div class="fixed-sides">
          <div class="side-row ai-side">
            <span class="picker-stone black"></span>
            <div class="side-copy">
              <strong>AI · 黑棋</strong>
              <small>固定先手 · 天元开局</small>
            </div>
            <span class="side-badge">必胜</span>
          </div>
          <div class="side-row">
            <span class="picker-stone white"></span>
            <div class="side-copy">
              <strong>你 · 白棋</strong>
              <small>后手应战</small>
            </div>
            <span class="side-tag">无禁手</span>
          </div>
        </div>
        <p class="first-note">
          AI 固定执黑先行。无禁手规则允许自由构筑双活三、四三杀，引擎会持续制造不可兼防的双威胁。
        </p>
      </div>

      <div class="field">
        <div class="field-label-row">
          <span class="field-label">AI 引擎</span>
          <span v-if="loading" class="loading-label">加载中</span>
        </div>
        <div class="select-shell">
          <select
            :value="engineId"
            :disabled="loading || engines.length === 0"
            aria-label="选择 AI 引擎"
            @change="onEngineChange"
          >
            <option v-for="engine in engines" :key="engine.id" :value="engine.id">
              {{ engine.name }}
            </option>
            <option v-if="engines.length === 0" value="">暂无可用引擎</option>
          </select>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </div>
      </div>

      <div class="field">
        <span class="field-label">AI 难度</span>
        <div class="level-list" role="group" aria-label="选择 AI 难度">
          <button
            v-for="levelOption in activeEngine?.levels ?? []"
            :key="levelOption.id"
            type="button"
            class="level-option"
            :class="{ selected: level === levelOption.id }"
            :title="levelOption.description"
            @click="emit('update:level', levelOption.id)"
          >
            {{ levelOption.name }}
          </button>
        </div>
        <p class="level-description">
          {{ activeLevel?.description ?? '选择引擎后即可开始对弈。' }}
        </p>
      </div>
    </template>

    <div v-else class="local-note">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 3v14M3 10h14" />
      </svg>
      同一设备轮流落子，黑棋先行。
    </div>

    <p class="settings-footnote">AI 固定执黑先行；切换设置会立即开启一局新棋。</p>
  </section>
</template>

<style scoped>
.settings-panel {
  padding: 20px 18px 16px;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

h1 {
  margin: 3px 0 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: 10.5px;
  font-weight: 500;
  white-space: nowrap;
}

.mode-chip i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.field {
  margin-top: 16px;
}

.field:first-of-type {
  margin-top: 0;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.loading-label {
  color: var(--accent-ink);
  font-size: 10.5px;
}

/* segmented control */

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--bg-sunken);
}

.segmented button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.segmented button svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.segmented button:hover {
  color: var(--text);
}

.segmented button.selected {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--text);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.05) inset;
}

/* sides */

.fixed-sides {
  display: grid;
  gap: 8px;
}

.side-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 46px;
  padding: 7px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.018);
}

.side-row.ai-side {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.035);
}

.side-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.side-copy strong {
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
}

.side-copy small {
  color: var(--faint);
  font-size: 10.5px;
}

.side-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-strong);
  color: #fff;
  font-size: 10.5px;
  font-weight: 500;
}

.side-tag {
  margin-left: auto;
  color: var(--muted);
  font-size: 10.5px;
}

.first-note {
  margin: 9px 2px 0;
  color: var(--faint);
  font-size: 11px;
  line-height: 1.65;
}

.picker-stone {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.picker-stone.black {
  background: radial-gradient(circle at 32% 24%, #5b626d, #1b1c20 60%, #0b0c0e);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.2);
}

.picker-stone.white {
  background: radial-gradient(circle at 32% 24%, #fff, #ece9e2 60%, #cbc5ba);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06), inset 0 1px rgba(255, 255, 255, 0.9);
}

/* select */

.select-shell {
  position: relative;
}

.select-shell select {
  width: 100%;
  height: 38px;
  padding: 0 34px 0 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  appearance: none;
  background: var(--bg-sunken);
  color: var(--text-soft);
  font-family: var(--font-sans);
  font-size: 12px;
  outline: none;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.select-shell select:hover,
.select-shell select:focus-visible {
  border-color: var(--line-strong);
  background: #14151a;
}

.select-shell select:disabled {
  opacity: 0.5;
  cursor: wait;
}

.select-shell svg {
  position: absolute;
  top: 50%;
  right: 12px;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}

.select-shell option {
  background: #17181d;
  color: var(--text);
}

/* levels */

.level-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 8px;
}

.level-option {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.018);
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 160ms ease, color 160ms ease, background-color 160ms ease;
}

.level-option:hover {
  border-color: var(--line-strong);
  color: var(--text);
}

.level-option.selected {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: var(--text);
}

.level-description {
  min-height: 16px;
  margin: 8px 2px 0;
  color: var(--faint);
  font-size: 11px;
  line-height: 1.6;
}

.local-note {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-md);
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.5;
}

.local-note svg {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.4;
  stroke-linecap: round;
}

.settings-footnote {
  margin: 16px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  color: var(--faint);
  font-size: 10.5px;
}
</style>
