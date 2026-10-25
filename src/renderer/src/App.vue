<script setup lang="ts">
import { computed } from 'vue'
import { BLACK, WHITE } from '@shared/game/types'
import GameBoard from './components/GameBoard.vue'
import ResultOverlay from './components/ResultOverlay.vue'
import SettingsPanel from './components/SettingsPanel.vue'
import StoneBadge from './components/StoneBadge.vue'
import TitleBar from './components/TitleBar.vue'
import { useGomokuGame } from './composables/useGomokuGame'

const game = useGomokuGame()

const shortEngineName = computed(() => {
  const name = game.activeEngine.value?.name
  return name ? name.replace(/\s*·.*$/, '') : '墨弈 AI'
})

const blackPlayer = computed(() => {
  const human = !game.isAI.value
  return {
    kind: human ? 'human' : 'ai',
    kicker: human ? 'PLAYER ONE · BLACK' : 'AI · BLACK',
    name: human ? '玩家一' : shortEngineName.value,
    active: game.phase.value === 'playing' && game.currentStone.value === BLACK,
    thinking: game.isAI.value && game.aiThinking.value
  }
})

const whitePlayer = computed(() => {
  return {
    kind: 'human',
    kicker: game.isAI.value ? 'YOU · WHITE' : 'PLAYER TWO · WHITE',
    name: game.isAI.value ? '你' : '玩家二',
    active: game.phase.value === 'playing' && game.currentStone.value === WHITE,
    thinking: false
  }
})

function handleEngineChange(engineId: string): void {
  game.setEngine(engineId)
}
</script>

<template>
  <div class="app-shell">
    <div class="ambient" aria-hidden="true"></div>
    <div class="ambient-grid" aria-hidden="true"></div>

    <TitleBar />

    <main class="workspace">
      <section class="stage" aria-label="五子棋棋盘">
        <div class="duel-bar">
          <article
            class="player-card"
            :class="{
              active: blackPlayer.active,
              ai: blackPlayer.kind === 'ai',
              thinking: blackPlayer.thinking
            }"
          >
            <StoneBadge :stone="BLACK" :active="blackPlayer.active" />
            <div class="player-copy">
              <span class="player-kicker">{{ blackPlayer.kicker }}</span>
              <span class="player-name">
                {{ blackPlayer.name }}
                <span v-if="blackPlayer.thinking" class="thinking-dots" aria-label="正在思考">
                  <i></i><i></i><i></i>
                </span>
              </span>
            </div>
            <span class="player-color">黑</span>
          </article>

          <div class="turn-center">
            <span class="turn-overline">{{ game.statusOverline.value }}</span>
            <div class="turn-status" aria-live="polite">
              <span class="turn-pulse" :class="{ waiting: game.aiThinking.value, ended: game.isGameOver.value }"></span>
              <span>{{ game.statusText.value }}</span>
            </div>
          </div>

          <article
            class="player-card ai-side"
            :class="{
              active: whitePlayer.active,
              ai: whitePlayer.kind === 'ai',
              thinking: whitePlayer.thinking
            }"
          >
            <StoneBadge :stone="WHITE" :active="whitePlayer.active" />
            <div class="player-copy">
              <span class="player-kicker">{{ whitePlayer.kicker }}</span>
              <span class="player-name">
                {{ whitePlayer.name }}
                <span v-if="whitePlayer.thinking" class="thinking-dots" aria-label="正在思考">
                  <i></i><i></i><i></i>
                </span>
              </span>
            </div>
            <span class="player-color">白</span>
          </article>
        </div>

        <div class="board-frame">
          <GameBoard
            :board="game.board.value"
            :current-stone="game.currentStone.value"
            :last-move="game.lastMove.value"
            :winning-cells="game.winningCells.value"
            :winning-line="game.winningLine.value"
            :interactive="game.canInteract.value"
            :disabled="!game.canInteract.value"
            @place="game.play"
          />

          <Transition name="result">
            <ResultOverlay
              v-if="game.resultVisible.value && game.result.value"
              :result="game.result.value"
              :move-count="game.moveCount.value"
              :elapsed="game.elapsedLabel.value"
              @restart="game.restart"
              @dismiss="game.dismissResult"
            />
          </Transition>
        </div>

        <div class="stage-caption" :class="{ alert: Boolean(game.errorMessage.value) }">
          <p>{{ game.statusHint.value }}</p>
          <button
            v-if="game.errorMessage.value && game.phase.value === 'playing' && game.isAI.value"
            class="text-action"
            type="button"
            @click="game.retryAI"
          >
            重试 AI
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M13.2 8a5.2 5.2 0 1 1-1.5-3.7M13.2 2.6v3.7H9.5" />
            </svg>
          </button>
        </div>

        <footer class="stage-footer">
          <div class="match-stats">
            <div class="stat">
              <span>手数</span>
              <strong>{{ String(game.moveCount.value).padStart(2, '0') }}</strong>
            </div>
            <i class="stat-divider"></i>
            <div class="stat">
              <span>用时</span>
              <strong>{{ game.elapsedLabel.value }}</strong>
            </div>
            <i class="stat-divider"></i>
            <div class="stat">
              <span>模式</span>
              <strong>{{ game.modeLabel.value }}</strong>
            </div>
          </div>

          <div class="footer-actions">
            <button
              class="secondary-button"
              type="button"
              :disabled="!game.canUndo.value"
              @click="game.undo"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M7.5 5.5 3.5 9l4 3.5M4 9h6.2a5 5 0 0 1 0 10H8" />
              </svg>
              悔棋
            </button>
            <button class="primary-button" type="button" @click="game.restart">
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M15.7 7.3A6.2 6.2 0 1 0 16 12M16 3.5v4.2h-4.2" />
              </svg>
              新对局
            </button>
          </div>
        </footer>
      </section>

      <aside class="sidebar">
        <SettingsPanel
          :mode="game.settings.mode"
          :engine-id="game.settings.engineId"
          :level="game.settings.level"
          :engines="game.engines.value"
          :active-engine="game.activeEngine.value"
          :loading="game.enginesLoading.value"
          @update:mode="game.setMode"
          @update:engine-id="handleEngineChange"
          @update:level="game.setLevel"
        />

        <section class="engine-card panel">
          <div class="engine-card-head">
            <div class="engine-glyph" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 2.5 13.7 9l5.8 3-5.8 3-1.7 6.5-1.7-6.5-5.8-3 5.8-3L12 2.5Z" />
              </svg>
            </div>
            <div>
              <span class="card-kicker">AI ENGINE</span>
              <h2>{{ game.activeEngine.value?.name ?? '正在载入引擎' }}</h2>
            </div>
            <span class="version-tag">v{{ game.activeEngine.value?.version ?? '1.0.0' }}</span>
          </div>
          <p class="engine-description">
            {{ game.activeEngine.value?.description ?? '正在与本地 AI 引擎建立连接…' }}
          </p>
          <div class="engine-meta">
            <span :class="{ ready: Boolean(game.activeEngine.value) }">
              <i></i>{{ game.activeEngine.value ? '引擎就绪' : '未连接' }}
            </span>
            <span>固定执黑先行</span>
            <span>{{ game.activeLevel.value?.name ?? '先手必胜' }}</span>
          </div>
        </section>

        <section class="extension-card panel">
          <div class="extension-head">
            <span class="card-kicker">EXTENSION READY</span>
            <span class="api-badge">AI API</span>
          </div>
          <p>AI 固定执黑先行；引擎通过统一接口注册，可无缝接入更强的本地或远程 AI。</p>
          <code>chooseMove(request, signal)</code>
        </section>
      </aside>
    </main>

    <Transition name="toast">
      <div v-if="game.notice.value" class="toast" role="status">
        <span class="toast-mark"></span>
        {{ game.notice.value }}
      </div>
    </Transition>
  </div>
</template>
