import { LibraryIcon } from './Icons'
import { resolveDeckColor, type DeckIcon } from '../config/deckAppearance'
import type { DeckConfig } from '../types'

interface Props {
  config?: Pick<DeckConfig, 'emoji' | 'icon' | 'color' | 'customColor'>
  size?: number
}

const iconPaths: Record<DeckIcon, string> = {
  'book-open': 'M4 5.5A2.5 2.5 0 016.5 3H11v17H6.5A2.5 2.5 0 004 22V5.5zm16 0A2.5 2.5 0 0017.5 3H13v17h4.5A2.5 2.5 0 0120 22V5.5z',
  language: 'M4 5h9M8.5 5c0 6-2 10-4.5 12m4.5-7H4m10 8 4-11 4 11m-6.7-4h5.4',
  translate: 'M4 7h12m0 0-3-3m3 3-3 3M20 17H8m0 0 3-3m-3 3 3 3',
  headphones: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v5H5a1 1 0 01-1-1v-4zm16 0h-3v5h2a1 1 0 001-1v-4z',
  speech: 'M5 4h14a2 2 0 012 2v9a2 2 0 01-2 2H10l-5 3v-3a2 2 0 01-2-2V6a2 2 0 012-2zm3 5h8m-8 4h5',
  code: 'M9 7 4 12l5 5m6-10 5 5-5 5m-3-12-2 14',
  terminal: 'M4 4h16v16H4V4zm4 5 3 3-3 3m5 1h4',
  database: 'M4 6c0-2 4-3 8-3s8 1 8 3-4 3-8 3-8-1-8-3zm0 0v6c0 2 4 3 8 3s8-1 8-3V6m-16 6v6c0 2 4 3 8 3s8-1 8-3v-6',
  brackets: 'M9 4H6v16h3m6-16h3v16h-3M11 8l-2 4 2 4m2-8 2 4-2 4',
  'git-branch': 'M7 5v10a4 4 0 004 4h6m0 0-3-3m3 3-3 3M7 5a2 2 0 110-4 2 2 0 010 4zm10 16a2 2 0 110-4 2 2 0 010 4z',
  function: 'M5 5h14M7 19l5-14m-5 7h8',
  atom: 'M12 12c2.5 0 4.5-1.2 4.5-2.7S14.5 6.6 12 6.6 7.5 7.8 7.5 9.3 9.5 12 12 12zm0 0c1.2 2.2 1.2 4.5-.1 5.2-1.3.7-3.4-.5-4.6-2.7S6.1 10 7.4 9.3C8.7 8.6 10.8 9.8 12 12zm0 0c-1.2 2.2-3.3 3.4-4.6 2.7-1.3-.7-1.3-3 .1-5.2s3.3-3.4 4.6-2.7c1.3.7 1.3 3-.1 5.2zM12 12h.01',
  flask: 'M9 3h6m-4 0v6l-5 8a3 3 0 002.6 4h6.8a3 3 0 002.6-4l-5-8V3m-4 11h6',
  calculator: 'M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 4h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zm6-3v15m6-12v15',
  dictionary: 'M5 4h11a3 3 0 013 3v13H8a3 3 0 00-3 3V4zm3 5h7m-7 4h5',
}

function DeckIconGlyph({ icon, size }: { icon: DeckIcon; size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[icon]} /></svg>
}

export function DeckAppearance({ config, size = 28 }: Props) {
  const iconSize = Math.round(size * 0.62)
  const color = resolveDeckColor(config) || 'var(--accent)'

  return (
    <span style={{
      width: size, height: size, flex: `0 0 ${size}px`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: `1px solid color-mix(in srgb, ${color} 60%, var(--border))`, borderRadius: 3,
      background: `color-mix(in srgb, ${color} 10%, var(--surface-color))`, color,
      fontSize: Math.round(size * 0.62), lineHeight: 1,
    }}>
      {config?.emoji || (config?.icon ? <DeckIconGlyph icon={config.icon} size={iconSize} /> : <LibraryIcon style={{ fontSize: iconSize }} />)}
    </span>
  )
}
