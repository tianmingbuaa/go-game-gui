<script setup lang="ts">
import { computed } from 'vue'
import { BLACK, type Stone } from '@shared/game/types'

const props = defineProps<{
  stone: Stone
  active?: boolean
}>()

const stoneClass = computed(() => (props.stone === BLACK ? 'black' : 'white'))
</script>

<template>
  <span class="stone-badge" :class="[stoneClass, { active }]" aria-hidden="true">
    <span class="stone-body"></span>
  </span>
</template>

<style scoped>
.stone-badge {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  transition: background-color 220ms ease, box-shadow 220ms ease;
}

/* soft halo that lights up when it's this side's turn */
.stone-badge::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(129, 140, 248, 0);
  transition: box-shadow 240ms ease;
}

.stone-badge.active::after {
  box-shadow: 0 0 0 4px rgba(129, 140, 248, 0.18);
}

.stone-body {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.stone-body::before {
  content: '';
  position: absolute;
  top: 15%;
  left: 24%;
  width: 30%;
  height: 19%;
  border-radius: 50%;
  transform: rotate(-22deg);
  background: rgba(255, 255, 255, 0.42);
  filter: blur(1.2px);
}

.black .stone-body {
  background: radial-gradient(circle at 32% 26%, #4a4f57 0%, #26282e 38%, #131418 72%, #0a0b0d 100%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.16),
    inset 0 -3px 6px rgba(0, 0, 0, 0.5),
    0 3px 6px rgba(0, 0, 0, 0.4);
}

.white .stone-body {
  background: radial-gradient(circle at 32% 26%, #ffffff 0%, #f6f4ef 40%, #e6e2d9 74%, #cfcac0 100%);
  box-shadow:
    inset 0 1px 1px rgba(255, 255, 255, 0.95),
    inset 0 -3px 6px rgba(120, 112, 96, 0.16),
    0 3px 6px rgba(0, 0, 0, 0.3);
}

.white .stone-body::before {
  background: rgba(255, 255, 255, 0.9);
}
</style>
