import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { exportDeckCSV } from '../lib/export'
import { randomTheme, THEME_IDS, THEME_META } from '../config/themes'

type CommandAction = () => void

interface Command {
  id: string
  label: string
  category: string
  keywords?: string
  action: CommandAction
}

interface Props {
  onGoDecks: () => void
  onGoStats: () => void
  onOpenSettings: () => void
  onOpenBackup: () => void
  onQuickStudy: (deck: string) => void
  onStopStudy?: () => void
  onOpenAI: () => void
  currentScreen?: string
}

export const CommandPalette = forwardRef<{ open: () => void }, Props>(({ onGoDecks, onGoStats, onOpenSettings, onOpenBackup, onQuickStudy, onStopStudy, onOpenAI, currentScreen }, ref) => {
  useImperativeHandle(ref, () => ({
    open: () => { setOpen(true); setQuery(''); setSelectedIdx(0) }
  }))
  const { t } = useLocale()
  const { theme, setTheme, settings, setSettings, importBackup, getDecks, getDeckCards, deleteDeck, addDeck, togglePinDeck, deckConfigs, cards, renameDeck, resetDeckProgress, deleteAllCards } = useFlashStore()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === 'Escape' && !open)) {
        e.preventDefault()
        setOpen(true)
        setQuery('')
        setSelectedIdx(0)
      } else if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  const commands: Command[] = [
    { id: 'nav-decks', label: t('nav.home'), category: t('nav.home'), keywords: 'decks home', action: () => { close(); onGoDecks() } },
    { id: 'nav-stats', label: t('stats.title'), category: t('nav.home'), keywords: 'stats statistics', action: () => { close(); onGoStats() } },
    { id: 'nav-settings', label: t('settings.title'), category: t('nav.home'), keywords: 'settings config', action: () => { close(); onOpenSettings() } },
    { id: 'nav-backup', label: t('settings.backup'), category: t('nav.home'), keywords: 'backup export import', action: () => { close(); onOpenBackup() } },
    { id: 'set-vim', label: settings.vimMode ? t('settings.vimMode') + ' OFF' : t('settings.vimMode') + ' ON', category: t('settings.general'), keywords: 'vim vi keys', action: () => { setSettings({ ...settings, vimMode: !settings.vimMode }); close() } },
    { id: 'create-deck', label: t('decks.newDeck'), category: t('decks.title'), keywords: 'new create deck', action: () => { const name = prompt(t('createDeck.name') + ':'); if (name && name.trim()) { addDeck(name.trim()); close() } } },
    { id: 'ai-generate', label: 'AI: ' + t('ai.generate'), category: 'AI', keywords: 'ai generate create cards mistral', action: () => { close(); onOpenAI() } },
    { id: 'delete-all-cards', label: t('deleteAllCards.title'), category: t('settings.general'), keywords: 'delete all cards clear', action: () => { if (confirm(t('deleteAllCards.desc'))) { deleteAllCards(); close() } } },
    ...(currentScreen === 'study' && onStopStudy ? [{ id: 'stop-study', label: t('study.stop'), category: t('nav.home'), keywords: 'stop study end', action: () => { close(); onStopStudy() } }] : []),
    { id: 'data-clear', label: t('settings.clear'), category: t('settings.general'), keywords: 'delete clear wipe', action: () => { if (confirm(t('settings.clearDesc'))) { importBackup({ cards: [], emptyDecks: [], deckConfigs: {}, theme }); close() } } },
    { id: 'theme-random', label: t('study.random') + ' ' + t('theme').toLowerCase(), category: t('theme'), keywords: 'random theme', action: () => { setTheme(randomTheme(theme)); close() } },
    ...THEME_IDS.map(key => ({
      id: `theme-${key}`,
      label: THEME_META[key].label,
      category: t('theme'),
      keywords: `theme ${THEME_META[key].label.toLowerCase()} ${key.replace(/-/g, ' ')}`,
      action: () => { setTheme(key); close() },
    })),
    ...getDecks().flatMap(name => {
      const count = getDeckCards(name).length
      const pinned = deckConfigs[name]?.pinned ?? false
      return [
        { id: `pin-${name}`, label: `${pinned ? t('decks.unpin') : t('decks.pin')}: ${name}`, category: t('decks.title'), keywords: 'pin unpin', action: () => { togglePinDeck(name); close() } },
        { id: `study-${name}`, label: `${t('decks.study')}: ${name} (${count})`, category: t('decks.title'), keywords: 'study review', action: () => { close(); onQuickStudy(name) } },
        { id: `export-${name}`, label: `${t('deck.export')}: ${name}`, category: t('decks.title'), keywords: 'export', action: () => { exportDeckCSV(name, cards.filter(c => c.deck === name)); close() } },
        { id: `rename-${name}`, label: `${t('deck.rename')}: ${name}`, category: t('decks.title'), keywords: 'rename', action: () => { const n = prompt(`${t('renameDeck.label')}:`, name); if (n && n.trim() && n.trim() !== name) { renameDeck(name, n.trim()); close() } } },
        { id: `reset-${name}`, label: `${t('deck.resetProgress')}: ${name}`, category: t('decks.title'), keywords: 'reset progress', action: () => { if (confirm(`${t('resetProgress.desc')} "${name}"?`)) { resetDeckProgress(name); close() } } },
        { id: `delete-${name}`, label: `${t('decks.delete')}: ${name}`, category: t('decks.title'), keywords: 'delete remove', action: () => { if (confirm(`${t('deleteDeck.desc')} "${name}"?`)) { deleteDeck(name); close() } } },
      ]
    }),
  ]

  const filtered = query.trim()
    ? commands.filter(c => {
        const q = query.toLowerCase()
        return c.label.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.keywords && c.keywords.toLowerCase().includes(q))
      })
    : commands

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault()
      filtered[selectedIdx].action()
    }
  }

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  useEffect(() => {
    if (listRef.current && filtered[selectedIdx]) {
      const el = listRef.current.children[selectedIdx] as HTMLElement
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIdx, filtered.length])

  if (!open) return null

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '10vh',
      animation: 'fadeIn 0.1s ease-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 3, width: '90%', maxWidth: 520,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        animation: 'modalScale 0.12s ease-out',
        display: 'flex', flexDirection: 'column', maxHeight: '70vh',
      }}>
        <input
          ref={inputRef}
          type="text"
          placeholder="Введите команду"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            background: 'var(--bg)', border: 'none', borderBottom: '1px solid var(--border)',
            color: 'var(--text)', padding: '14px 16px', fontFamily: 'var(--font)',
            fontSize: 14, outline: 'none', borderRadius: '3px 3px 0 0',
          }}
        />
        <div ref={listRef} style={{
          overflowY: 'auto', flex: 1, padding: '4px 0',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
              {t('decks.emptySearch')}
            </div>
          ) : filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              onClick={() => cmd.action()}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                padding: '8px 16px', cursor: 'pointer', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center', gap: 12,
                background: i === selectedIdx ? 'var(--surface-hover)' : 'transparent',
                color: i === selectedIdx ? 'var(--text)' : 'var(--text-muted)',
                transition: 'background var(--speed), color var(--speed)',
                fontSize: 13,
              }}
            >
              <span>{cmd.label}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {cmd.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})
