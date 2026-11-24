# dsh-deepblue-hud

> 深蓝驾驶舱 HUD —— 给 DeepSeek Harness Web UI 加一块常驻的「仪表盘」浮层：会话经济、系统体征、工具轨迹，同时把整套界面切成深蓝主题。

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
![version](https://img.shields.io/badge/version-0.2.0-38bdf8)
![DSH](https://img.shields.io/badge/DSH-0.2.x-0a1524)
![platform](https://img.shields.io/badge/platform-win%20%7C%20mac%20%7C%20linux-1c3450)

`dsh-deepblue-hud` 是一个 DSH **bundle 插件**（Host 半 + Client 半）。装上后：

- **右下角**常驻一个可折叠的 `Cockpit` 浮层，展开是三组面板，折叠后只剩一条标题栏；
- 整个 Web UI 变成深蓝配色（约 60% 深蓝底 / 30% 层级过渡 / 10% 潮汐蓝强调）；
- 卸载或停用后界面**完全恢复原样**。

---

## 安装

仓库里带着构建好的 `lib/`，任何一种装法**都不需要再 build**。

```bash
# 1) 直接从 GitHub 装
dsh plugin --profile <profile> add github:zzricls/dsh-deepblue-hud

# 2) 已克隆到本地时
dsh plugin --profile <profile> add /absolute/path/to/dsh-deepblue-hud

# 3) 在 DSH 的 Plugin Manager 里：install_bundle，target 填包的绝对路径
```

装完重开 Harness：右下角（输入区上方）出现 `Cockpit`，界面变深蓝。停用插件即完全还原。

---

## 效果

```
┌──────────────────────────────────────┐
│ ◆ 驾驶舱 · 深蓝   示例        上下文 75%│  ← 折叠态只留这一条；「示例」= 数据未接
├──────────────────────────────────────┤
│ 会话                          经济   │
│   Tokens           18.6k 入 / 3.4k 出 │
│   速度                    46.8 tok/s│  ← 潮汐蓝，只给关键数值
│   费用估算                    ¥0.0837│
│   上下文        96.4k / 128.0k · 75% │
│   ████████████████░░░░░░░░░░░  偏紧  │  ← 绿(充裕)/黄(偏紧)/红(将满)
│ 系统                          体征   │
│   CPU                            34% │
│   ██████░░░░░░░░░░░░░░░░░░░░░░       │
│   内存     62%  20.0 GB / 32.0 GB    │
│   ████████████░░░░░░░░░░░░░░░░       │
│   磁盘                           81% │
│   ████████████████░░░░░░░░░░░░       │
│   网络          ↑ 428 KB/s  ↓ 1.8 MB/s
│ 轨迹                    5 步 · 1 失败│
│   ● read_file src/client/index.ts 41ms
│   ● 并行 ×2                       1.8s │
│   │  ○ web_search slots api       1.4s │
│   │  ○ web_search theme tokens    1.8s │
│   ● pwsh pnpm build          重试 1  ← 黄：重试
│   ● edit src/client/panel.tsx     12ms│
│   ● pwsh pnpm typecheck        TS2322 ← 红：失败
└──────────────────────────────────────┘
```

（上面是 0.2.0 的静态标本数据，用来把布局、分组、阈值颜色一次定稿；头部那个橙色「示例」角标就是提醒这一点，接上真实数据后自动消失。）

---

## 安装

包内 `cordis.patch.yml` 会插入一行 `deepblue-hud` 插件行，Client 半通过 `dsh.client` 声明被自动打包进 Web 页面，不需要手工改配置。

---

## 主题：一层 token 覆盖，卸载即还原

深蓝主题不是一堆 CSS 覆盖，而是**一层 theme token**：

```ts
ctx.effect(() => ctx.theme.overrideTokens('dsh-deepblue-hud', DEEP_BLUE))
```

- `overrideTokens(source, tokens)` 在**当前主题之上**叠一层，`tokens` 是 `{ token名: { light, dark } }`；
- 一个 `source` 只对应一层，组件卸载 / 插件停用 → 这一层被移除 → 用户原来的配色原样回来；
- 面板自己的 CSS **只用 token**，没有任何颜色字面量（`scripts/smoke.mjs` 会断言这一点）。

只覆盖真实存在的 token。当前版本校准过的 **47 个** token 全部在安装包的 token 词表里（`@deepseek-ai/dsh-client-ui-theme` 的 platform 样式表 + Web 前端的 alias 变量），覆盖 `--dsw-alias-bg-base / bg-layer-1..4 / bg-overlay`、`--dsw-alias-label-primary|secondary|tertiary|caption|dimmed|error`、`--dsw-alias-border-l1..l4`、`--dsw-alias-brand-primary`、`--dsw-alias-state-success|warn|error|idle|business-*`、`--dsw-specific-sidebar-fill` 等。写错名字不会报错、只会静默无效，所以加 token 前请先在 `Theme` 目录里核对。

> **注意**：这是**全局换肤**，不是只给浮层上色。如果你只想要"HUD 自己是深蓝、其余界面不变"，不要调用 `overrideTokens`，把 `styles.ts` 里的 token 引用换成固定值即可——但那就不再是主题层了。

---

## 停靠位置与「不遮挡输入区」

浮层挂在 `shell.overlay`（框架级浮层，`list` 型座位，框架其它列之上、滚动容器之外）。这个座位本身 `pointer-events: none`，宿主 CSS 给每个条目的根节点 `pointer-events: auto`，所以只有卡片本身可点，其余区域照常穿透。

输入区在 DSH 里是一条 **横跨会话列底部的 composer seat**（绝对定位、`bottom: 0`、卡片居中）。所以「右下角」如果贴着视口底边，就一定会压在输入卡片上。本插件的处理：

- 面板 `right: 16px`，`bottom: var(--dbh-dock-bottom, 168px)` —— 抬到输入带之上；
- 发送按钮在输入卡片底部，因此即使输入框涨高（`--dsh-composer-text-max-height` 上限 336px），面板底边也不会压住任何控件；
- 想更靠下可以自己调：

```js
document.documentElement.style.setProperty('--dbh-dock-bottom', '120px')
```

窄窗口（≤960px）会自动收窄到 264px 并下调停靠高度。

---

## 无障碍与动效

- **只动 `opacity` 和 `transform`**：入场是 `translateY(10px) → 0` 淡入上浮，三组面板按 40ms 阶梯错开；进度条用 `scaleX()` 而不是 `width`；折叠是 `translateY(6px)` + 淡出；星星漂移与闪烁、光标闪烁同样只碰这两个属性。没有布局属性过渡。
- **唯一的例外是打字机**：逐字揭示本质是文本内容变更（必然重排），所以轨迹区明确破例一次——只对最新两行逐字，行高固定、`contain: layout` 把重排限制在行内，`prefers-reduced-motion` 下整段直出。
- **`prefers-reduced-motion: reduce`** 时全部动画与过渡清零，折叠也不走 180ms 的淡出，直接切换。
- 标题栏是真正的 `<button>`（`aria-expanded` / `aria-controls`，Enter/Space 原生可用，有 focus 环），进度条是 `role="progressbar"` 并带 `aria-valuenow`，轨迹圆点是 `aria-hidden`（信息在文字里）。

---

## 数据来源与边界（重要）

| 部分 | 状态 | 来源 |
|---|---|---|
| 三组面板的布局、分组、阈值、动效、主题 | 已完成 | — |
| 会话经济：Tokens / 速度 / 上下文 | **真实数据** | `tokenUsage`（`totals` 四个桶）与 `contextPressure`（`contextWindow` / `projectedTokens`）两个 session projection |
| 费用估算 | 需要你填价目表才显示 | `src/client/pricing.ts`；Harness 不暴露单价，留空则整行隐藏，不估算成假数 |
| 系统体征（CPU / 内存 / 磁盘 / 网络） | 待接入，面板显示「主机通道未接入」 | 需要 Host→Client 通道（见下） |
| 轨迹 / 指令流 | **真实数据 + 打字机** | `useTrajectory` 的 inspection（`runningCalls` / `eventNodes`），逐字呈现，运行中有闪烁光标 |
| 思考过程（reasoning 文本） | 有则显示，无则跳过 | 同一个 inspection 里的 reasoning 字段；拿不到时不编造 |
| 正文 Markdown | 自建渲染器 | `markdown.tsx`：标题/段落/围栏代码/行内代码/粗斜体/删除线/链接/引用/列表/分隔线；无 `innerHTML` |
| 思考块折叠 | 已做 | 最新一块展开并逐字，成为历史后自动折成一行预览 |
| 数据流弹窗 | 已做 | 面板底部「数据流 · 展开」：token 节奏柱 / 上下文曲线 + 70%·90% 阈值 / 思考与执行流 |
| Host 半 | 空 `apply()` | — |

### 数据桥：为什么多了一个不渲染的入口

session projection 只能在**会话作用域**里读，而面板挂在 `root` 作用域的 `shell.overlay` 上。所以插件注册了**两个**座位条目：

1. `shell.overlay` → 面板本身（常驻右下角）；
2. `conversation.input.dock` → 一个**返回 null 的采集组件**，它读投影、写进模块级 store（`src/client/live.ts`），面板用 `useSyncExternalStore` 订阅。

两个条目都由 `slots.inject` 托管，任何一个座位消失都不会抛错。没有会话时 store 是 idle 快照，面板显示「等待会话」而不是零值。

### 为什么 Host 半是空的

安装式插件的 Client 半**没有** `ctx.host.call`（它只属于动态 Cordis 包的浏览器半，配套 Host 半的 `harness.handle`）。Host 数据回浏览器只有三条路：

1. **session projection** —— 已用它拿到了会话经济；但投影是会话作用域，系统体征（进程级）拿不到；
2. **Typert Remote 命名空间** —— 需要生成产物，第三方插件目前没有注册入口；
3. **Host `webServer` 路由 + 客户端 fetch** —— 社区先例是 `dshmarket`，系统体征会走这条。

### 星空是实验项

`--dsw-alias-bg-base` 这个 token 的值被写成**多层径向渐变**（不是颜色），于是 frame 与中栏的 `background: var(--dsw-alias-bg-base)` 直接铺出整页星空；`fixed` 附着让它跨元素无缝。

代价：少数需要**颜色**的消费者（`background-color:`、`color-mix(… var(--…bg-base) …)`）会失效，最明显的是输入区底部的渐隐。不满意就改一个字：

```ts
// src/client/theme.ts
const useStarfield = false   // 立刻回到纯深蓝底色
```

数据入口收敛在 `src/client/liveModel.ts` 的 `buildLiveSnapshot()`，换数据源不需要改视图。

---

## 开发

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm build       # tsdown → lib/index.js (ESM) + lib/client.js (CJS 包 __ModuleLoader__) + sourcemap
pnpm smoke       # 装载 + 渲染 + 断言
pnpm verify      # 三件一起跑
```

`lib/` 是**产物**，不要手改；源码在 `src/`。

构建约定：

- Host 半 `src/index.ts` → `lib/index.js`（ESM，dts 一并产出）；
- Client 半 `src/client/index.ts` → `lib/client.js`：tsdown 输出 CommonJS 主体，再由 `banner`/`footer` 包成

  ```js
  window.__ModuleLoader__.load({ id: 'dsh-deepblue-hud', factory: (require) => { ... return module.exports } })
  ```

  这是 `dsh-client-modules` 认的安装式 Client 模块格式；`react` 与 `react/jsx-runtime` 是平台自带的 external，不进包体。
- `scripts/fix-client-map.mjs` 把 sourcemap 按包装行数整体下移，保证调试时行号对得上。

`node scripts/smoke.mjs` 会把 `lib/client.js` 按页面同样的方式装载，塞进一个会记账的假 `ctx`，静态渲染组件并断言：三组面板都在、token 层名合法且是 `{light,dark}` 对、CSS 里没有颜色字面量、只动 opacity/transform、减速动画存在、座位与注册参数正确、卸载后主题层/样式/座位条目全部撤掉。

---

## 目录结构

```
dsh-deepblue-hud/
├── package.json            # dsh.bundle.patch + dsh.client 声明
├── cordis.patch.yml        # 顶层数组，insert 一行插件
├── tsdown.config.ts        # 两次构建：宿主 ESM / 客户端 CJS+包装
├── scripts/
│   ├── fix-client-map.mjs  # 对齐包装后的 sourcemap
│   └── smoke.mjs           # 装载 + 渲染 + 断言
├── src/
│   ├── index.ts            # Host 半（0.2 为空实现）
│   └── client/
│       ├── index.ts        # apply(): token 层 / 样式 / 座位注册
│       ├── context.ts      # 用到的 ctx 成员的结构化类型
│       ├── theme.ts        # 深蓝 token 层（唯一允许出现颜色字面量的地方）
│       ├── styles.ts       # 面板 CSS（只用 token）
│       ├── panel.tsx       # 三组面板 + 折叠逻辑
│       ├── placeholder.ts  # 静态标本数据
│       ├── source.ts       # 数据接缝（0.3 换这里）
│       ├── format.ts       # 数字/单位/阈值
│       └── types.ts        # 快照形状
└── lib/                    # 构建产物
```

---

## 校准过的 API（0.2.x）

| 用到的 | 形态 |
|---|---|
| `ctx.effect(fn, label?)` | `fn` 返回 disposer；fiber 卸载时统一回收 |
| `ctx.theme.overrideTokens(source, tokens)` | 一层 / source，返回移除该层的 disposer |
| `ctx.slots.inject(ownerKey, cb)` | 等座位声明之后再注册，声明消失即撤销 |
| `ctx.slots.register(options, Component)` | `list` 座位必须带 `id`；`name` 是座位 key |
| `shell.overlay` | `list` 型、`root` 作用域，条目根节点自动 `pointer-events: auto` |

Host 半目前不使用任何 `ctx.*`；0.3 引入采样循环时会用 `ctx.interval(fn, ms)`（`timer` 服务）。

---

## 路线图

- ~~**0.3** 会话经济接真实数据~~ —— 已用 `tokenUsage` / `contextPressure` 投影接入
- ~~**0.4** 轨迹 / 指令流 + 打字机~~ —— 已用 `useTrajectory` + 接管 `assistant-step` 实现
- ~~**0.5** 数据流弹窗~~ —— 已完成
- **下一步** 系统体征：需要 Host→Client 通道（`webServer` 路由或会话投影之外的手段），面板现在诚实地显示「主机通道未接入」
- **下一步** 费用估算：`pricing.ts` 填入你自己的 CNY 价目表后才会显示；Harness 不暴露单价，本插件不编造
- **待补** 工具调用行的输出展开（接管后目前只有紧凑一行）

---

## 设计取舍

- **为什么不用 `conversation.*` 座位**：那些是会话作用域，切到"无会话"页面就消失；Cockpit 要求常驻，所以用 `shell.overlay`。
- **为什么进度条不用 `width` 过渡**：`width` 触发 layout，违反"只动 opacity/transform"的硬约束；`scaleX` 是合成层变换。
- **为什么没有进度环**：SVG 环的"填充量"要靠 `stroke-dashoffset`，那是绘制属性，同样违反约束；用条 + 阈值色表达"快满没满"已足够，且更可读。
- **为什么 token 名逐条核对**：`overrideTokens` 不校验名字，写错只是静默失效——这类 bug 在深色背景上极难发现，所以宁可先用 grep 对一遍安装包的 token 目录。
- **为什么 `lib/*.js` 不手写**：构建产物与源码必须分离，否则每次改样式都要手改两处，且 sourcemap 无从谈起。

---

## License

[MIT](./LICENSE)
