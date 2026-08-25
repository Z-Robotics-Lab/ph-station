/** `phdash` namespace dictionaries: the 实验台 dashboard tab label and its
 * toolbar copy (title, hint, reset). Panel titles come from each docked view's
 * own locale, not here. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'phdash'

/** The phdash dictionary key set (source of truth for both locales). */
export type PhDashKey =
  | 'view.dash'
  | 'title'
  | 'hint'
  | 'reset'
  | 'resetHint'
  | 'jump'
  | 'jumpPlaceholder'
  | 'jumpEmpty'
  | 'maximize'
  | 'restore'
  | 'reserveHint'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The 实验台 drag-composable dashboard copy. */
    'phdash': PhDashKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<PhDashKey, string> = {
  'view.dash': '实验台',
  'title': '实验台',
  'hint': '拖拽面板可重排 / 分屏 / 合成标签组 · 布局自动保存',
  'reset': '重置布局',
  'resetHint': '恢复默认排布（对话 · 执行台 · 其余面板）',
  'jump': '跳转面板',
  'jumpPlaceholder': '跳转到面板…（↑↓ 选择 · Enter 打开 · Esc 关闭）',
  'jumpEmpty': '没有匹配的面板',
  'maximize': '最大化面板（Esc 还原）',
  'restore': '还原面板',
  'reserveHint': '拖动调整输入区高度 · 双击还原',
}

/** English dictionary. */
export const en: Record<PhDashKey, string> = {
  'view.dash': 'Cockpit',
  'title': 'Cockpit',
  'hint': 'Drag panels to rearrange / split / group into tabs · layout auto-saves',
  'reset': 'Reset layout',
  'resetHint': 'Restore the default arrangement (chat · cockpit · the rest)',
  'jump': 'Jump to panel',
  'jumpPlaceholder': 'Jump to a panel… (↑↓ select · Enter open · Esc close)',
  'jumpEmpty': 'No matching panel',
  'maximize': 'Maximize panel (Esc to restore)',
  'restore': 'Restore panel',
  'reserveHint': 'Drag to resize the composer band · double-click to restore',
}
