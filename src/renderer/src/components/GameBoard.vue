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
    <div class="grain" aria-hidden="true"></div>
    <div class="vignette" aria-hidden="true"></div>

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

      <g class="grid-highlights" aria-hidden="true">
        <line
          v-for="(position, index) in positions"
          :key="`vh-${index}`"
          :x1="position + 0.045"
          :y1="GRID_START"
          :x2="position + 0.045"
          :y2="GRID_END"
        />
        <line
          v-for="(position, index) in positions"
          :key="`hh-${index}`"
          :x1="GRID_START"
          :y1="position + 0.045"
          :x2="GRID_END"
          :y2="position + 0.045"
        />
      </g>

      <g class="star-points">
        <template v-for="([row, col], index) in stars" :key="index">
          <circle :cx="positions[col]" :cy="positions[row]" r="0.72" class="star-ring" />
          <circle :cx="positions[col]" :cy="positions[row]" r="0.4" class="star-dot" />
        </template>
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
          x="2.75"
          :y="position + 0.52"
          text-anchor="middle"
        >
          {{ index + 1 }}
        </text>
      </g>
    </svg>

    <svg v-if="winCoords" class="win-layer" viewBox="0 0 100 100" aria-hidden="true">
      <line
        class="win-line-halo"
        :x1="winCoords.x1"
        :y1="winCoords.y1"
        :x2="winCoords.x2"
        :y2="winCoords.y2"
        pathLength="1"
      />
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
  border-radius: 6px;
  background-color: var(--board-wood-2);
  background-image:
    repeating-linear-gradient(
      176deg,
      rgba(150, 118, 74, 0.028) 0px,
      rgba(150, 118, 74, 0.028) 1px,
      transparent 1px,
      transparent 3.5px
    ),
    repeating-linear-gradient(
      173.4deg,
      rgba(150, 118, 74, 0.045) 0px,
      rgba(150, 118, 74, 0.045) 1.2px,
      transparent 1.2px,
      transparent 12px
    ),
    radial-gradient(85% 60% at 24% -4%, rgba(255, 252, 244, 0.7), transparent 64%),
    linear-gradient(160deg, var(--board-wood-1) 0%, var(--board-wood-2) 58%, var(--board-wood-3) 100%);
  box-shadow:
    0 0 0 1px rgba(48, 33, 16, 0.62),
    0 1px 0 rgba(255, 247, 230, 0.3) inset,
    0 0 0 5px rgba(0, 0, 0, 0.09) inset,
    0 0 30px rgba(0, 0, 0, 0.22) inset,
    0 3px 6px rgba(0, 0, 0, 0.5);
}

/* satin finish: a soft diagonal sheen plus faint mineral grain */
.grain {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
  opacity: 0.2;
  mix-blend-mode: multiply;
}

.grain::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    104deg,
    transparent 0%,
    transparent 34%,
    rgba(255, 255, 255, 0.1) 42%,
    rgba(255, 255, 255, 0.03) 50%,
    transparent 58%,
    transparent 100%
  );
  mix-blend-mode: soft-light;
}

/* warm shadow gathering at the edges so the board reads as a solid plane */
.vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 92% 92% at 50% 48%, transparent 56%, rgba(84, 58, 28, 0.16) 100%),
    linear-gradient(180deg, rgba(255, 248, 235, 0.18), transparent 16%);
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

/* engraved lines: a crisp ink stroke with a light chip above it */
.grid-lines line {
  stroke: var(--board-line);
  stroke-width: 0.135;
  stroke-linecap: round;
  stroke-linejoin: round;
  shape-rendering: geometricPrecision;
}

.grid-highlights line {
  stroke: rgba(255, 251, 242, 0.42);
  stroke-width: 0.07;
  stroke-linecap: round;
  shape-rendering: geometricPrecision;
}

/* the outer rim is pressed a little deeper, like a real go board */
.grid-lines line:is([x1='6'], [y1='6']),
.grid-lines line:is([x1='94'], [y1='94']) {
  stroke: var(--board-line-edge);
  stroke-width: 0.17;
}

.star-ring {
  fill: none;
  stroke: rgba(255, 249, 236, 0.55);
  stroke-width: 0.1;
}

.star-dot {
  fill: rgba(62, 46, 25, 0.82);
}

.coordinates text {
  fill: var(--board-ink);
  font-family: var(--font-sans);
  font-size: 1.45px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.win-layer {
  z-index: 4;
}

/* soft halo under the winning line keeps it legible on both stone colours */
.win-line-halo {
  stroke: rgba(255, 252, 246, 0.7);
  stroke-width: 0.36;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-win-line 560ms cubic-bezier(0.22, 1, 0.36, 1) 80ms forwards;
}

.win-line {
  stroke: var(--accent-strong);
  stroke-width: 0.13;
  stroke-linecap: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-win-line 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
  width: 7.2%;
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
  inset: 12%;
  border: 2px solid var(--accent-strong);
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.75);
}

/* ------------------------------------------------------------- stones */

.stone {
  position: relative;
  display: grid;
  place-items: center;
  width: 90%;
  aspect-ratio: 1;
  border-radius: 50%;
  animation: stone-drop 220ms cubic-bezier(0.2, 0.9, 0.3, 1.18) both;
}

/* contact shadow cast by the stone onto the board */
.stone::after {
  content: '';
  position: absolute;
  z-index: -1;
  left: 8%;
  right: 8%;
  bottom: -4%;
  height: 24%;
  border-radius: 50%;
  background: radial-gradient(ellipse at 50% 40%, rgba(52, 32, 10, 0.42), transparent 72%);
  filter: blur(1.2px);
  transition: opacity 200ms ease;
}

.stone.black {
  background:
    radial-gradient(circle at 74% 86%, rgba(128, 140, 162, 0.2), transparent 42%),
    radial-gradient(circle at 34% 22%, #3f444d 0%, #262930 22%, #14161a 56%, #060708 100%);
  box-shadow:
    0 0 0 0.6px rgba(0, 0, 0, 0.55),
    0 1px 0 rgba(255, 255, 255, 0.14) inset,
    0 -3px 6px rgba(0, 0, 0, 0.65) inset,
    0 2px 3px rgba(60, 40, 14, 0.42);
}

.stone.white {
  background:
    radial-gradient(circle at 74% 84%, rgba(168, 160, 146, 0.32), transparent 44%),
    radial-gradient(circle at 34% 22%, #ffffff 0%, #faf8f3 24%, #ebe7de 60%, #d4cec2 100%);
  box-shadow:
    0 0 0 0.6px rgba(92, 74, 48, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.95) inset,
    0 -3px 6px rgba(138, 124, 100, 0.35) inset,
    0 2px 3px rgba(60, 40, 14, 0.34);
}

/* specular highlight */
.stone::before {
  content: '';
  position: absolute;
  top: 12%;
  left: 23%;
  width: 28%;
  height: 17%;
  border-radius: 50%;
  transform: rotate(-28deg);
  background: radial-gradient(ellipse at 42% 45%, rgba(255, 255, 255, 0.46), transparent 68%);
  filter: blur(0.9px);
}

.stone.white::before {
  background: radial-gradient(ellipse at 40% 45%, rgba(255, 255, 255, 1), transparent 74%);
}

/* rim light along the lower edge, reads like polished clamshell / slate */
.stone.winning {
  z-index: 1;
  animation: stone-win-pulse 1.7s ease-in-out infinite;
}

.stone.winning::after {
  content: '';
  position: absolute;
  inset: -6%;
  z-index: 2;
  border-radius: 50%;
  border: max(1.5px, 0.08em) solid var(--accent-strong);
  opacity: 0.85;
  box-shadow:
    0 0 0 0.9px rgba(255, 253, 248, 0.7),
    0 1px 2px rgba(40, 26, 8, 0.25);
  animation: win-ring 1.7s ease-in-out infinite;
}

.last-marker {
  position: relative;
  z-index: 3;
  width: 26%;
  aspect-ratio: 1;
  border-radius: 50%;
  animation: last-marker-in 240ms ease-out both;
}

.stone.black .last-marker {
  background: var(--accent);
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.25);
}

.stone.white .last-marker {
  background: var(--accent-strong);
  box-shadow: 0 0 0 0.5px rgba(255, 255, 255, 0.7);
}

/* -------------------------------------------------- hover / preview */

.ghost-stone {
  width: 90%;
  aspect-ratio: 1;
  border-radius: 50%;
  opacity: 0;
  transform: scale(0.86);
  transition: opacity 140ms ease, transform 160ms ease;
  pointer-events: none;
}

.ghost-stone.black {
  background: radial-gradient(circle at 34% 22%, #3f444d, #060708 82%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.ghost-stone.white {
  background: radial-gradient(circle at 34% 22%, #ffffff, #d4cec2 86%);
  box-shadow: inset 0 0 0 0.5px rgba(92, 74, 48, 0.35);
}

.intersection:not(:disabled):hover .ghost-stone,
.intersection:not(:disabled):focus-visible .ghost-stone {
  opacity: 0.42;
  transform: scale(1);
}

/* ----------------------------------------------------------- motion */

@keyframes stone-drop {
  from {
    opacity: 0;
    transform: scale(0.72) translateY(-8%);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes win-ring {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 0.8;
  }
}

@keyframes stone-win-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}

@keyframes last-marker-in {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  to {
    opacity: 1;
    transform: scale(1);
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
  .stone.winning::after,
  .last-marker,
  .win-line,
  .win-line-halo,
  .ghost-stone {
    animation: none;
    transition: none;
  }

  .win-line,
  .win-line-halo {
    stroke-dashoffset: 0;
  }
}
</style>
