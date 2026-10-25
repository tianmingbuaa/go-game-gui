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
  border-radius: 19px;
  overflow: hidden;
  border: 1px solid rgba(72, 44, 17, 0.34);
  background:
    radial-gradient(115% 85% at 16% 6%, rgba(255, 243, 213, 0.38), transparent 40%),
    radial-gradient(85% 70% at 96% 102%, rgba(83, 43, 12, 0.24), transparent 58%),
    repeating-linear-gradient(93deg, rgba(91, 51, 18, 0.045) 0, rgba(91, 51, 18, 0.045) 1px, transparent 1px, transparent 7px),
    repeating-linear-gradient(2deg, rgba(94, 52, 14, 0.025) 0, rgba(94, 52, 14, 0.025) 1px, transparent 1px, transparent 13px),
    linear-gradient(135deg, #e5bb83 0%, #d8a76a 42%, #c89153 76%, #b88045 100%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.38),
    inset 0 0 64px rgba(94, 54, 18, 0.16),
    inset 0 -2px 5px rgba(84, 45, 13, 0.2);
}

.board-surface::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    linear-gradient(102deg, transparent 0 46%, rgba(255, 249, 232, 0.09) 46.2%, transparent 46.6%),
    radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(92, 50, 16, 0.12) 100%);
  mix-blend-mode: soft-light;
}

.board-surface::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.3;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
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
  stroke: rgba(67, 41, 16, 0.58);
  stroke-width: 0.15;
}

.star-points circle {
  fill: rgba(61, 37, 14, 0.78);
}

.coordinates text {
  fill: rgba(67, 42, 17, 0.58);
  font-family: var(--font-sans);
  font-size: 1.55px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.win-layer {
  z-index: 4;
}

.win-line {
  stroke: rgba(255, 246, 218, 0.93);
  stroke-width: 0.52;
  stroke-linecap: round;
  filter:
    drop-shadow(0 0 0.6px rgba(255, 220, 151, 0.9))
    drop-shadow(0 0 2.4px rgba(245, 190, 95, 0.8));
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-win-line 620ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
  width: 6.25%;
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
  inset: 8%;
  border: 1px solid rgba(255, 249, 225, 0.8);
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(65, 40, 14, 0.16);
}

.stone {
  position: relative;
  display: grid;
  place-items: center;
  width: 90%;
  aspect-ratio: 1;
  border-radius: 50%;
  animation: stone-drop 200ms cubic-bezier(0.2, 0.9, 0.3, 1.25) both;
}

.stone.black {
  background:
    radial-gradient(circle at 31% 23%, #626b77 0%, #2c333f 23%, #131821 58%, #07090d 100%);
  box-shadow:
    0 2.5px 4px rgba(45, 27, 8, 0.55),
    0 6px 10px rgba(45, 27, 8, 0.18),
    inset 0 1px 1.5px rgba(255, 255, 255, 0.24),
    inset 0 -4px 6px rgba(0, 0, 0, 0.62);
}

.stone.white {
  background:
    radial-gradient(circle at 31% 23%, #fffef9 0%, #f5efe2 34%, #dbd0bd 70%, #b5a78f 100%);
  box-shadow:
    0 2.5px 4px rgba(55, 34, 11, 0.42),
    0 6px 10px rgba(55, 34, 11, 0.14),
    inset 0 1px 1.5px rgba(255, 255, 255, 0.9),
    inset 0 -4px 6px rgba(96, 78, 50, 0.3);
}

.stone::before {
  content: '';
  position: absolute;
  top: 14%;
  left: 23%;
  width: 29%;
  height: 19%;
  border-radius: 50%;
  transform: rotate(-24deg);
  background: rgba(255, 255, 255, 0.35);
  filter: blur(0.6px);
}

.stone.white::before {
  background: rgba(255, 255, 255, 0.82);
}

.stone.winning {
  animation: stone-win-pulse 1.6s ease-in-out infinite;
}

.last-marker {
  position: relative;
  z-index: 2;
  width: 26%;
  aspect-ratio: 1;
  border-radius: 50%;
}

.stone.black .last-marker {
  background: #f5cf8f;
  box-shadow: 0 0 0 1px rgba(25, 18, 8, 0.45), 0 0 6px rgba(245, 207, 143, 0.7);
}

.stone.white .last-marker {
  background: #8d6334;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.32);
}

.ghost-stone {
  width: 90%;
  aspect-ratio: 1;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.84);
  transition: opacity 150ms ease, transform 150ms ease;
  pointer-events: none;
}

.ghost-stone.black {
  background: radial-gradient(circle at 32% 25%, #3b4350, #0b0e13 70%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.16);
}

.ghost-stone.white {
  background: radial-gradient(circle at 32% 25%, #fffdf6, #cec2ac 78%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.85);
}

.intersection:not(:disabled):hover .ghost-stone,
.intersection:not(:disabled):focus-visible .ghost-stone {
  opacity: 0.34;
  transform: scale(1);
}

@keyframes stone-drop {
  from {
    opacity: 0.4;
    transform: scale(0.64);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes stone-win-pulse {
  0%,
  100% {
    box-shadow:
      0 2.5px 4px rgba(45, 27, 8, 0.5),
      0 0 0 0 rgba(255, 225, 161, 0.28);
  }
  50% {
    box-shadow:
      0 2.5px 4px rgba(45, 27, 8, 0.5),
      0 0 0 4px rgba(255, 225, 161, 0.2),
      0 0 16px rgba(255, 215, 140, 0.42);
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
