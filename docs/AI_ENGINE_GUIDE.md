# AI 引擎扩展指南

本文说明如何在不改动界面的情况下，为墨弈五子棋增加新的 AI 引擎。

> **本版本的固定先手约定**：人机模式中 AI 永远执黑先行，玩家固定执白。渲染层只会以
> `aiStone = BLACK`、`opponentStone = WHITE` 发起请求。新增引擎可以自行选择白棋应手，
> 但不应假设玩家可以执黑，也不要依赖“AI 后行”的界面选项。

## 1. 接口契约

接口位于 [`src/shared/ai.ts`](../src/shared/ai.ts)：

```ts
export interface AIEngineLevel {
  id: string
  name: string
  description: string
}

export interface AIEngineInfo {
  id: string
  name: string
  version: string
  description: string
  levels: readonly AIEngineLevel[]
}

export interface AIMoveRequest {
  board: Board                 // 长度 225 的一维棋盘，0 空 / 1 黑 / 2 白
  aiStone: Stone               // AI 执子颜色；本应用人机模式固定为 BLACK
  opponentStone: Stone
  history: readonly Move[]     // 按时间正序的已落子记录
  level: string                // 从 info.levels 中选择的难度 id
}

export interface AIMove {
  index: number                // row * 15 + col
  reason?: string
  score?: number
}

export interface AIEngine {
  readonly info: AIEngineInfo
  chooseMove(
    request: Readonly<AIMoveRequest>,
    signal?: AbortSignal
  ): Promise<AIMove>
}

export interface AIEngineRegistry {
  register(engine: AIEngine): void
  unregister(engineId: string): boolean
  list(): readonly AIEngineInfo[]
  get(engineId: string): AIEngine | undefined
}
```

### 约定

- `board` 是 `readonly` 视角，引擎不得修改传入数组。
- 必须返回一个当前为空的合法索引；主进程会再次校验落点。
- `info.id` 必须全局唯一；`levels` 至少包含一项。
- `chooseMove` 可以是异步的，适合远程 API、Worker 或 WASM 引擎。
- 应检查 `signal?.aborted`。主进程设有 8 秒超时，超时后会 abort 并返回错误。
- 引擎运行在 Electron 主进程；重计算引擎最好把 CPU 工作放进 Worker 或 `utilityProcess`，避免阻塞窗口。
- 引擎实现不要假设自己能看到 DOM、Vue 状态或网络凭据。

## 2. 请求如何流转

```text
Vue 视图
  → useGomokuGame 组装纯 JSON 快照
  → preload bridge: window.gomoku.ai.chooseMove(payload)
  → ipcMain.handle('ai:choose-move')
  → 参数校验 + 8s 超时
  → registry.get(engineId).chooseMove(request, signal)
  → 校验落点是否为空
  → 返回 { ok, move, engineId, elapsedMs }
```

界面通过 `ai:list-engines` 动态读取引擎和难度，因此注册表就是唯一的接入点。

> **IPC 注意**：请求必须能通过结构化克隆。渲染层已经把手上的 Vue reactive array 转为普通数组。给 `AIMoveRequest` 增加字段时，也要确保字段是纯数据，不能是 Proxy、函数或类实例。

## 3. 添加一个引擎

可参考两份内置实现：

- [`src/main/ai/engines/first-player/`](../src/main/ai/engines/first-player/)：默认注册的
  先手必胜引擎（VCF + 迭代加深 α-β）。
- [`src/main/ai/engines/classic.ts`](../src/main/ai/engines/classic.ts)：保留在仓库中的
  轻量参考引擎，用于测试和扩展指南，不注册到人机模式。

### 3.1 实现接口

新建 `src/main/ai/engines/random.ts`：

```ts
import type { AIEngine, AIEngineInfo, AIMove, AIMoveRequest } from '../../../shared/ai'
import { EMPTY } from '../../../shared/game/types'

export class RandomAI implements AIEngine {
  readonly info: AIEngineInfo = {
    id: 'random-demo',
    name: '随机示例引擎',
    version: '0.1.0',
    description: '演示扩展方式：在合法空位中随机落子。',
    levels: [
      { id: 'default', name: '默认', description: '随机选择合法落点。' }
    ]
  }

  async chooseMove(request: Readonly<AIMoveRequest>, signal?: AbortSignal): Promise<AIMove> {
    signal?.throwIfAborted()

    const empty: number[] = []
    request.board.forEach((cell, index) => {
      if (cell === EMPTY) empty.push(index)
    })

    if (empty.length === 0) throw new Error('棋盘已满')

    const index = empty[Math.floor(Math.random() * empty.length)]!
    return { index, reason: '随机落子' }
  }
}
```

### 3.2 注册

编辑 [`src/main/ai/registry.ts`](../src/main/ai/registry.ts)：

```ts
import { RandomAI } from './engines/random'

export function createAIRegistry(): AIEngineRegistry {
  const registry = new DefaultAIEngineRegistry()
  registry.register(new ClassicHeuristicAI())
  registry.register(new RandomAI())   // ← 新增
  return registry
}
```

在 `createAIRegistry()` 中注册后，设置面板的「AI 引擎」下拉框会自动出现新引擎，它的难度按钮也会根据 `levels` 自动渲染。当前生产注册表只包含先手必胜引擎；若要发布新引擎，替换或追加该注册即可。

> 注意：人机模式现在固定 AI 执黑先行。如果你的引擎是防守型或只擅长后手，它仍会以黑棋被调用；请在引擎内部处理这一前提，或不要把它注册到本模式。

### 3.3 测试引擎

建议在 `tests/` 下增加不依赖 Electron 的单元测试：

```ts
import { describe, expect, it } from 'vitest'
import { RandomAI } from '../src/main/ai/engines/random'
import { createEmptyBoard, isLegalMove } from '../src/shared/game/rules'

it('returns a legal move', async () => {
  const board = createEmptyBoard()
  const engine = new RandomAI()
  const move = await engine.chooseMove({
    board,
    aiStone: 1,
    opponentStone: 2,
    history: [],
    level: 'default'
  })
  expect(isLegalMove(board, move.index)).toBe(true)
})
```

运行：

```bash
pnpm test
pnpm typecheck
```

## 4. 进阶方向

### 搜索型引擎

在 `chooseMove` 内部做 Minimax / Alpha-Beta / MCTS 时，建议：

1. 先把候选点限制在当前棋子周围 1–2 格，控制分支因子。
2. 使用棋形增量评分缓存，避免每层重复扫描整个棋盘。
3. 每次递归检查 `AbortSignal`，以便超时后及时退出。
4. 若耗时超过几十毫秒，将计算移入 Worker，并使用消息协议适配 `AIEngine`。

先手必胜引擎额外采用了以下战术顺序，可以作为强攻型引擎的参考：

- 即时成五 / 封堵必败点；
- 对方“活四制造点”的抢占（不处理会被对手做出双成五点）；
- VCF 连续冲四搜索：只走冲四，防方应手唯一；若防方自己有即时成五则此路作废；
- 迭代加深 α-β，候选按“进攻棋型 + 防守棋型”排序，并对活三 / 冲四做强制延伸；
- 棋型评估区分活四、冲四、活三、眠三，避免把双威胁当成普通连接。

VCF 是可靠的“找到即必胜”搜索；VCT 更完整但必须严格枚举防方对活三的所有应手（包括反冲四），否则很容易误判。若没有实现完整的 VCT 反杀规则，建议只把 VCF 结果当作必胜，其余交给 α-β 评估。

### 远程引擎

`chooseMove` 可以是异步网络请求：

```ts
async chooseMove(request, signal) {
  const response = await fetch('https://ai.example.com/move', {
    method: 'POST',
    body: JSON.stringify(request),
    signal
  })
  const data = await response.json()
  return { index: data.index, reason: data.reason }
}
```

生产环境应加鉴权、重试与更细的超时，并避免把服务端密钥放进渲染层。远程引擎的失败会显示在棋盘下方，并提供「重试 AI」按钮。

### 多引擎共存

注册表支持任意数量的引擎。每个引擎可以拥有不同的难度集合；切换引擎会开启一局新棋。要为新引擎增加专属配置，可为 `AIMoveRequest` 添加可选字段，并在设置页添加对应 UI。

## 5. 不要做的事

- 不要假设 AI 还能执白或后行；人机模式固定 AI 执黑先行。
- 不要在引擎里修改 `request.board`。
- 不要返回已占用的索引；即使主进程会拦截，也应在引擎侧保证合法。
- 不要在接口中暴露 Node 对象、DOM 节点或 Vue ref。
- 不要忽略 `AbortSignal`，否则超时后计算可能继续占用主进程。
- 不要直接把第三方服务密钥硬编码进主进程或渲染层。
