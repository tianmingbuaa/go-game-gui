import type { AIEngine, AIEngineInfo, AIEngineRegistry } from '../../shared/ai'
import { ClassicHeuristicAI } from './engines/classic'

/**
 * In-process registry. Register another engine here (or from a future plugin
 * loader) and it automatically appears in the renderer's engine picker.
 */
export class DefaultAIEngineRegistry implements AIEngineRegistry {
  private readonly engines = new Map<string, AIEngine>()

  register(engine: AIEngine): void {
    const { id, name, levels } = engine.info
    if (!id.trim() || !name.trim()) {
      throw new Error('AI 引擎必须提供非空的 id 与 name')
    }
    if (levels.length === 0) {
      throw new Error(`AI 引擎 ${id} 至少需要一个难度`)
    }
    if (this.engines.has(id)) {
      throw new Error(`AI 引擎 ${id} 已注册`)
    }
    this.engines.set(id, engine)
  }

  unregister(engineId: string): boolean {
    return this.engines.delete(engineId)
  }

  list(): readonly AIEngineInfo[] {
    return [...this.engines.values()].map((engine) => engine.info)
  }

  get(engineId: string): AIEngine | undefined {
    return this.engines.get(engineId)
  }
}

export function createAIRegistry(): AIEngineRegistry {
  const registry = new DefaultAIEngineRegistry()
  registry.register(new ClassicHeuristicAI())
  return registry
}
