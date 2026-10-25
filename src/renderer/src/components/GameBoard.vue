<script setup lang="ts">
import { computed } from 'vue'
import {
  BOARD_SIZE,
  BLACK,
  EMPTY,
  WHITE,
  type Board,
  type Move,
  type Stone,
  type WinningLine
} from '@shared/game/types'
import { columnLabel, formatMoveLabel, toPosition } from '@shared/game/rules'

const props = defineProps<{
  board: Board
  currentStone: Stone
  lastMove: Move | null
  winningCells: ReadonlySet<number>
  winningLine: WinningLine | null
  interactive: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  place: [index: number]
}>()

const GRID_START = 6
const GRID_END = 94
const GRID_STEP = (GRID_END - GRID_START) / (BOARD_SIZE - 1)
const positions = Array.from({ length: BOARD_SIZE }, (_, index) => GRID_START + index * GRID_STEP)
const columns = Array.from({ length: BOARD_SIZE }, (_, index) => columnLabel(index))
const stars = [
  [3, 3],
  [3, 11],
  [7, 7],
  [11, 3],
  [11, 11]
] as const

const winCoords = computed(() => {
  const cells = props.winningLine?.cells
  if (!cells || cells.length < 2) return null
  const first = cells[0]
  const last = cells[cells.length - 1]
  if (first === undefined || last === undefined) return null
  const firstPos = toPosition(first)
  const lastPos = toPosition(last)
  return {
    x1: positions[firstPos.col] ?? GRID_START,
    y1: positions[firstPos.row] ?? GRID_START,
    x2: positions[lastPos.col] ?? GRID_END,
    y2: positions[lastPos.row] ?? GRID_END
  }
})

function pointStyle(index: number): Record<string, string> {
  const { row, col } = toPosition(index)
  return {
    left: `${positions[col] ?? GRID_START}%`,
    top: `${positions[row] ?? GRID_START}%`
  }
}

function ghostClass(): string {
  return props.currentStone === BLACK ? 'black' : 'white'
}

function stoneClass(cell: number): string {
  return cell === BLACK ? 'black' : 'white'
}

function pointLabel(index: number, cell: number): string {
  const { row, col } = toPosition(index)
  const position = formatMoveLabel(row, col)
  if (cell === BLACK) return `${position}，黑棋`
  if (cell === WHITE) return `${position}，白棋`
  return props.interactive ? `${position}，可落子` : `${position}，空位`
}

function place(index: number): void {
  if (!props.interactive || props.board[index] !== EMPTY) return
  emit('place', index)
}
</script>

<template>
  <div class="board-surface" :class="{ locked: !interactive }">
    <svg class="grid-layer" viewBox="0 0 100 100" aria-hidden="true">
      <g class="grid-lines">
        <line
          v-for="(position, index) in positions"
          :key="`v-${index}`"
          :x1="position"
          :y1="GRID_START"
          :x2="position"
          :y2="GRID_END"
        />
        <line
          v-for="(position, index) in positions"
          :key="`h-${index}`"
          :x1="GRID_START"
          :y1="position"
          :x2="GRID_END"
          :y2="position"
        />
      </g>

      <g class="star-points">
        <circle
          v-for="([row, col], index) in stars"
          :key="index"
          :cx="positions[col]"
          :cy="positions[row]"
          r="0.62"
        />
      </g>

      <g class="coordinates">
        <text
          v-for="(label, index) in columns"
          :key="`col-${label}`"
          :x="positions[index]"
          y="3.15"
          text-anchor="middle"
        >
          {{ label }}
        </text>
        <text
          v-for="(position, index) in positions"
          :key="`row-${index}`"
          x="2.8"
          :y="position + 0.48"
          text-anchor="middle"
        >
          {{ index + 1 }}
        </text>
      </g>
    </svg>

    <svg v-if="winCoords" class="win-layer" viewBox="0 0 100 100" aria-hidden="true">
      <line
        class="win-line"
        :x1="winCoords.x1"
        :y1="winCoords.y1"
        :x2="winCoords.x2"
        :y2="winCoords.y2"
        pathLength="1"
      />
    </svg>

    <div class="points" role="group" aria-label="五子棋棋盘，15 乘 15">
      <button
        v-for="(cell, index) in board"
        :key="index"
        class="intersection"
        type="button"
        :style="pointStyle(index)"
        :disabled="disabled || cell !== EMPTY"
        :aria-label="pointLabel(index, cell)"
        @click="place(index)"
      >
        <span
          v-if="cell !== EMPTY"
          class="stone"
          :class="[
            stoneClass(cell),
            {
              winning: winningCells.has(index),
              'last-move': lastMove?.index === index
            }
          ]"
        >
          <span v-if="lastMove?.index === index" class="last-marker"></span>
        </span>
        <span
          v-else-if="interactive"
          class="ghost-stone"
          :class="ghostClass()"
        ></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.board-surface {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 18px;
  background:
    radial-gradient(120% 90% at 18% 4%, rgba(255, 255, 255, 0.5), transparent 46%),
    radial-gradient(90% 80% at 100% 100%, rgba(150, 118, 74, 0.12), transparent 62%),
    linear-gradient(150deg, var(--board-paper) 0%, #eee7da 55%, #e7ded0 100%);
  box-shadow:
    inset 0 0 0 1px rgba(96, 74, 40, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

/* waxed-paper grain */
.board-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.5;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.07'/%3E%3C/svg%3E");
  mix-blend-mode: multiply;
}

.grid-layer,
.win-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.grid-layer {
  z-index: 2;
}

.grid-lines line {
  stroke: var(--board-line);
  stroke-width: 0.16;
}

.star-points circle {
  fill: var(--board-line-strong);
}

.coordinates text {
  fill: var(--board-ink);
  font-family: var(--font-sans);
  font-size: 1.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.win-layer {
  z-index: 4;
}

.win-line {
  stroke: var(--accent-strong);
  stroke-width: 0.4;
  stroke-linecap: round;
  filter: drop-shadow(0 0 0.8px rgba(255, 255, 255, 0.9));
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-win-line 560ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
}

.points {
  position: absolute;
  inset: 0;
  z-index: 3;
}

.intersection {
  position: absolute;
  display: grid;
  place-items: center;
  width: 6.4%;
  aspect-ratio: 1;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.intersection:disabled {
  cursor: default;
  opacity: 1;
}

.intersection:focus-visible {
  outline: none;
}

.intersection:focus-visible::after {
  content: '';
  position: absolute;
  inset: 6%;
  border: 1.5px solid var(--accent-strong);
  border-radius: 50%;
  opacity: 0.75;
}

.stone {
  position: relative;
  display: grid;
  place-items: center;
  width: 88%;
  aspect-ratio: 1;
  border-radius: 50%;
  animation: stone-drop 200ms cubic-bezier(0.2, 0.9, 0.3, 1.2) both;
}

.stone.black {
  background: radial-gradient(circle at 33% 26%, #50565f 0%, #262930 32%, #131418 70%, #090a0c 100%);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 2px 2px rgba(70, 54, 30, 0.28),
    0 5px 10px rgba(70, 54, 30, 0.2),
    inset 0 1px 1px rgba(255, 255, 255, 0.18),
    inset 0 -4px 7px rgba(0, 0, 0, 0.5);
}

.stone.white {
  background: radial-gradient(circle at 33% 26%, #ffffff 0%, #f8f6f1 36%, #e9e5dc 72%, #d3cec4 100%);
  box-shadow:
    0 0 0 1px rgba(96, 74, 40, 0.14),
    0 2px 2px rgba(96, 74, 40, 0.2),
    0 5px 10px rgba(96, 74, 40, 0.16),
    inset 0 1px 1px rgba(255, 255, 255, 0.95),
    inset 0 -4px 7px rgba(120, 104, 78, 0.16);
}

.stone::before {
  content: '';
  position: absolute;
  top: 14%;
  left: 24%;
  width: 28%;
  height: 17%;
  border-radius: 50%;
  transform: rotate(-24deg);
  background: rgba(255, 255, 255, 0.32);
  filter: blur(0.8px);
}

.stone.white::before {
  background: rgba(255, 255, 255, 0.92);
}

/* winning stones get a quiet accent halo instead of gold glow */
.stone.winning {
  z-index: 1;
  animation: stone-win-pulse 1.8s ease-in-out infinite;
}

.stone.winning::after {
  content: '';
  position: absolute;
  inset: -14%;
  border: 1.5px solid var(--accent-strong);
  border-radius: 50%;
  opacity: 0.85;
}

.last-marker {
  position: relative;
  z-index: 2;
  width: 24%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.stone.black .last-marker {
  background: var(--accent);
}

.stone.white .last-marker {
  background: var(--accent-strong);
}

.ghost-stone {
  width: 88%;
  aspect-ratio: 1;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.82);
  transition: opacity 140ms ease, transform 140ms ease;
  pointer-events: none;
}

.ghost-stone.black {
  background: radial-gradient(circle at 33% 26%, #50565f, #0a0b0d 75%);
}

.ghost-stone.white {
  background: radial-gradient(circle at 33% 26%, #ffffff, #d3cec4 80%);
}

.intersection:not(:disabled):hover .ghost-stone,
.intersection:not(:disabled):focus-visible .ghost-stone {
  opacity: 0.36;
  transform: scale(1);
}

@keyframes stone-drop {
  from {
    opacity: 0.4;
    transform: scale(0.6);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes stone-win-pulse {
  0%,
  100% {
    transform: scale(1.04);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes draw-win-line {
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .stone,
  .stone.winning,
  .win-line,
  .ghost-stone {
    animation: none;
    transition: none;
  }

  .win-line {
    stroke-dashoffset: 0;
  }
}
</style>
