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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transition: box-shadow 240ms ease, transform 240ms ease;
}

.stone-badge::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid rgba(230, 184, 114, 0);
  transition: border-color 240ms ease, transform 240ms ease;
}

.stone-badge.active::after {
  border-color: rgba(230, 184, 114, 0.36);
  transform: scale(1.04);
}

.stone-body {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  position: relative;
}

.stone-body::before {
  content: '';
  position: absolute;
  top: 16%;
  left: 22%;
  width: 30%;
  height: 20%;
  border-radius: 50%;
  transform: rotate(-24deg);
  background: rgba(255, 255, 255, 0.45);
  filter: blur(1px);
}

.black .stone-body {
  background:
    radial-gradient(circle at 31% 24%, #6c7480 0%, #313844 24%, #11151d 62%, #07090e 100%);
  box-shadow:
    0 5px 8px rgba(0, 0, 0, 0.5),
    inset 0 1px 1px rgba(255, 255, 255, 0.18),
    inset 0 -4px 7px rgba(0, 0, 0, 0.55);
}

.white .stone-body {
  background:
    radial-gradient(circle at 31% 24%, #fffdf6 0%, #f4eee1 35%, #d8cebc 72%, #aa9d86 100%);
  box-shadow:
    0 5px 8px rgba(0, 0, 0, 0.38),
    inset 0 1px 1px rgba(255, 255, 255, 0.8),
    inset 0 -4px 7px rgba(94, 78, 54, 0.28);
}

.white .stone-body::before {
  background: rgba(255, 255, 255, 0.88);
}
</style>
