# @deepseek-ai/dsh-client-ui-ph-icons

[English](README.md) | 中文

PH 驾驶舱图标集：[tabler-icons](https://github.com/tabler/tabler-icons)（MIT）的一个小型 vendor 子集，以类型化 React 原子组件呈现。每个字形是 24×24 的 outline，`stroke="currentColor"`，因此继承周围文本颜色，无需按主题单独设色。图标接受 `{ size = 16, className }`，渲染一个装饰性（`aria-hidden`）`<svg>`。

这个集合是刻意精选的，不是完整的约 5900 个图标的包：驾驶舱只用固定的一小撮（标签条、面板标题、节点 kind、状态 chips、按钮），因此路径直接拷入而不是引入运行时依赖。署名见仓库 [`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md)。

这是一个共享平台叶子（类似 `ui-primitives`）：它被播种进冻结的浏览器模块表，让受纯度门禁约束的插件 bundle（`ui-conversation`、`ui-ph-*`）能够值引入其组件。

## 用法

```tsx
import { IconBox, Icon } from '@deepseek-ai/dsh-client-ui-ph-icons'

<IconBox size={14} />            // by named export
const Glyph = Icon['sitemap']    // by tabler outline name
```

## 添加图标

把 `@tabler/icons/icons/outline/<name>.svg` 里的 `<path d=…>` 主体拷进 `src/icons.tsx` 的一个新组件（共享的 `Svg` 包装器提供框架与描边），再把它加入 `Icon` 索引。

## 模型体验

无，因为本包是纯浏览器侧的展示性图标集，不贡献任何工具、prompt、会话事件或模型可见文本。

#### KV Cache 影响

无；本包从不组装或发送 provider 请求。

## 已知限制与暂缓事项

- 导出的集合只覆盖驾驶舱今天渲染的字形（标签条和少量面板配件）。`docs/ph-cockpit-v3.md` §4.2 点名的其余图标（节点 kind、状态 chips、按钮、空态）随使用它们的面板落地时按需添加——是推迟，不是缺失。
