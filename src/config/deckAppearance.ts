export const DECK_ICON_IDS = [
  'book-open', 'language', 'translate', 'headphones', 'speech', 'code', 'terminal', 'database',
  'brackets', 'git-branch', 'function', 'atom', 'flask', 'calculator', 'map', 'dictionary',
] as const
export type DeckIcon = typeof DECK_ICON_IDS[number]

export const DECK_EMOJIS = [
  '📘', '📚', '📝', '✏️', '🔤', '💬', '🗣️', '🎧', '🎓', '🌍', '✈️', '🧭', '🗺️', '🏠', '☕', '🍎',
  '🍕', '🍳', '🌿', '🌸', '🌙', '☀️', '⭐', '🔥', '⚡', '💡', '🎯', '🏆', '🎮', '🎵', '🎨', '📷',
  '💻', '⌨️', '📱', '🔬', '🧪', '🧬', '🧮', '📐', '🧩', '🚀', '🏃', '⚽', '🏀', '🎸', '🎬', '📖',
  '📰', '🛒', '🚗', '🚆', '🏖️', '🐶', '🐱', '🐼', '🦊', '🌈', '🍀', '🧠', '🤝', '💼', '🔑', '⏰',
] as const

export const DECK_COLOR_IDS = [
  'slate', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'yellow', 'amber', 'orange',
  'red', 'rose', 'pink', 'fuchsia', 'purple', 'violet', 'indigo', 'brown',
] as const
export type DeckColor = typeof DECK_COLOR_IDS[number]

export const DECK_COLOR_VALUES: Record<DeckColor, string> = {
  slate: '#64748b',
  blue: '#3b82f6',
  sky: '#0ea5e9',
  cyan: '#06b6d4',
  teal: '#14b8a6',
  green: '#22c55e',
  lime: '#84cc16',
  yellow: '#eab308',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  pink: '#ec4899',
  purple: '#a855f7',
  rose: '#f43f5e',
  fuchsia: '#d946ef',
  violet: '#8b5cf6',
  indigo: '#6366f1',
  brown: '#a16207',
}

export function resolveDeckColor(config?: { color?: DeckColor; customColor?: string }): string | undefined {
  return config?.customColor || (config?.color ? DECK_COLOR_VALUES[config.color] : undefined)
}
