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
}

/** English dictionary. */
export const en: Record<PhDashKey, string> = {
  'view.dash': 'Cockpit',
  'title': 'Cockpit',
  'hint': 'Drag panels to rearrange / split / group into tabs · layout auto-saves',
  'reset': 'Reset layout',
  'resetHint': 'Restore the default arrangement (chat · cockpit · the rest)',
}
