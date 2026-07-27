import { useState, useRef, useEffect, useMemo } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { Modal } from '../components/Modal'
import { ProgressBar } from '../components/ProgressBar'
import { ContextMenu } from '../components/ContextMenu'
import { DeckSettingsModal } from '../components/DeckSettingsModal'
import { DeckAppearance } from '../components/DeckAppearance'
import { resolveDeckColor } from '../config/deckAppearance'
import { primaryBtn, secondaryBtn, dangerBtn, inputField } from '../lib/styles'
import { PinIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon } from '../components/Icons'

interface Props {
  onOpenDeck: (name: string) => void
  onOpenStats?: () => void
  onQuickStudy: (name: string) => void
  onOpenAI?: () => void
  onOpenSettings?: () => void
  toast: (msg: string, err?: boolean) => void
}

export function DecksScreen({ onOpenDeck, onOpenStats, onQuickStudy, onOpenAI, onOpenSettings, toast }: Props) {
  const { t } = useLocale()
  const { getDecks, getDeckCards, getDueCards, deckConfigs, folders, togglePinDeck, addDeck, addCards, cards, deleteDecks, deleteAllCards, updateDeckConfig, settings, addFolder, deleteFolder, renameFolder, toggleFolderCollapsed, getDecksByFolder } = useFlashStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [importCards, setImportCards] = useState<{ q: string; a: string; transcription?: string; transcriptionPlacement?: 'question' | 'answer' }[]>([])
  const [studyConfirm, setStudyConfirm] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [deleteAllDecksOpen, setDeleteAllDecksOpen] = useState(false)
  const [deleteAllCardsOpen, setDeleteAllCardsOpen] = useState(false)
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false)
  const [deckSearch, setDeckSearch] = useState('')
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renameFolderOpen, setRenameFolderOpen] = useState<string | null>(null)
  const [renameFolderValue, setRenameFolderValue] = useState('')
  const [moveDeckFolder, setMoveDeckFolder] = useState<string | null>(null)
  const [moveFolderOpen, setMoveFolderOpen] = useState(false)

  const searchRef = useRef<HTMLDivElement>(null)
  const [focusIdx, setFocusIdx] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target?: string } | null>(null)
  const [ctxDeckSettings, setCtxDeckSettings] = useState<string | null>(null)

  const decks = getDecks()
  const totalDue = getDueCards().length
  const deckSearchLower = deckSearch.toLowerCase().trim()
  const filteredDecks = useMemo(() =>
    !deckSearchLower ? decks : decks.filter(n => n.toLowerCase().includes(deckSearchLower)),
    [decks, deckSearchLower]
  )
  const progressPct = cards.length > 0 ? Math.round((cards.filter(card => card.reps > 0).length / cards.length) * 100) : 0
  const grouped = useMemo(() => getDecksByFolder(), [getDecksByFolder])

  useEffect(() => {
    if (!settings.vimMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const list = filteredDecks
      if (e.key === 'j') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, list.length - 1)) }
      else if (e.key === 'k') { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
      else if (e.key === 'Enter' && list[focusIdx]) { e.preventDefault(); if (selectMode) { const next = new Set(selected); if (next.has(list[focusIdx])) next.delete(list[focusIdx]); else next.add(list[focusIdx]); setSelected(next) } else onOpenDeck(list[focusIdx]) }
      else if (e.key === 'n') { e.preventDefault(); setCreateOpen(true) }
      else if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus() }
      else if (e.key === 'v') { e.preventDefault(); if (selectMode) { setSelected(new Set()); setSelectMode(false) } else { setSelectMode(true); setDeleteAllDecksOpen(false); setDeleteAllCardsOpen(false) } }
      else if (e.key === 'd' && selectMode && selected.size > 0) { e.preventDefault(); setDeleteSelectedOpen(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settings.vimMode, filteredDecks, focusIdx, selectMode, selected, onOpenDeck])

  const handleCreate = () => {
    if (!deckName.trim()) {
      toast(t('errors.emptyName'), true)
      return
    }
    if (decks.some(d => d.toLowerCase() === deckName.toLowerCase())) {
      toast(t('errors.deckExists'), true)
      return
    }
    const name = deckName.trim()
    addDeck(name)
    if (importCards.length > 0) {
      addCards(name, importCards.map(c => ({ question: c.q, answer: c.a, transcription: c.transcription, transcriptionPlacement: c.transcriptionPlacement })))
    }
    setCreateOpen(false)
    setDeckName('')
    setImportCards([])
    toast(`${t('decks.newDeck').replace('+ ', '')} "${name}" ${t('createDeck.create').toLowerCase()}${importCards.length > 0 ? ' (+' + importCards.length + ' ' + t('import.cards') + ')' : ''}`)
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const nameFromFile = file.name.replace(/\.[^.]+$/, '')
    if (!deckName.trim()) setDeckName(nameFromFile)
    const reader = new FileReader()
    reader.onload = () => {
      let text = reader.result as string
      text = text.replace(/^\uFEFF/, '')
      const rawLines = text.split(/\r?\n/).filter(l => l.trim())
      if (rawLines.length === 0) {
        toast(t('import.fileEmpty'), true)
        return
      }

      const HEADER_WORDS = new Set(['question', 'answer', 'front', 'back', 'word', 'translation', 'term', 'definition', 'expression', 'meaning', 'phrase', 'vocabulary', 'transcription', 'transcriptionplacement', 'interval', 'ease', 'reps', 'lapses', 'nextreview', 'pinned'])

      function parseCSVLine(line: string, sep: string): string[] {
        if (sep !== ',') return line.split(sep).map(s => s.trim())
        const parts: string[] = []
        let cur = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
          const ch = line[i]
          if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
            else inQuotes = !inQuotes
          } else if (ch === sep && !inQuotes) { parts.push(cur.trim()); cur = '' }
          else cur += ch
        }
        parts.push(cur.trim())
        return parts
      }

      function detectSep(line: string): string {
        const counts: [string, number][] = [
          ['\t', (line.match(/\t/g) || []).length],
          [';', (line.match(/;/g) || []).length],
          [',', (line.match(/,/g) || []).length],
          ['|', (line.match(/\|/g) || []).length],
        ]
        counts.sort((a, b) => b[1] - a[1])
        return counts[0][1] >= 1 ? counts[0][0] : ','
      }

      const sep = detectSep(rawLines[0])
      const firstParts = parseCSVLine(rawLines[0], sep)
      const isHeaderRow = firstParts.length >= 2 && firstParts.some(p => HEADER_WORDS.has(p.trim().toLowerCase()))
      const startIdx = isHeaderRow ? 1 : 0

      const headers = isHeaderRow ? firstParts.map(part => part.trim().toLowerCase()) : []
      const questionIndex = Math.max(0, headers.findIndex(header => ['question', 'front', 'word', 'term', 'expression', 'phrase', 'vocabulary'].includes(header)))
      const answerIndex = isHeaderRow
        ? headers.findIndex(header => ['answer', 'back', 'translation', 'definition', 'meaning'].includes(header))
        : 1
      const transcriptionIndex = headers.indexOf('transcription')
      const placementIndex = headers.indexOf('transcriptionplacement')
      const parsed: { q: string; a: string; transcription?: string; transcriptionPlacement?: 'question' | 'answer' }[] = []
      for (let i = startIdx; i < rawLines.length; i++) {
        const parts = parseCSVLine(rawLines[i], sep)
        if (parts.length >= 2 && answerIndex >= 0) {
          const transcription = transcriptionIndex >= 0 ? parts[transcriptionIndex]?.trim() : undefined
          const transcriptionPlacement = placementIndex >= 0 && parts[placementIndex]?.trim().toLowerCase() === 'answer' ? 'answer' : 'question'
          const answer = isHeaderRow ? parts[answerIndex]?.trim() : parts.slice(1).join(' ').trim()
          const question = parts[questionIndex]?.trim() || ''
          if (question && answer) parsed.push({ q: question, a: answer, transcription: transcription || undefined, transcriptionPlacement })
        }
      }

      if (parsed.length === 0) {
        toast(t('import.parseError'), true)
        return
      }
      setImportCards(parsed)
      toast(t('import.loaded') + ' ' + parsed.length + ' ' + t('import.cards') + (!deckName.trim() ? '' : ' → ' + deckName))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleCreateFolder = () => {
    if (!folderName.trim()) return
    addFolder(folderName.trim())
    setFolderName('')
    setCreateFolderOpen(false)
  }

  const handleRenameFolder = () => {
    if (!renameFolderOpen || !renameFolderValue.trim()) return
    renameFolder(renameFolderOpen, renameFolderValue.trim())
    setRenameFolderOpen(null)
  }

  const handleMoveDeckToFolder = (deck: string, folder: string | null) => {
    updateDeckConfig(deck, { folder: folder ?? undefined })
    setMoveDeckFolder(null)
    setMoveFolderOpen(false)
  }

  const deckCard = (name: string, idx: number, borderColor?: string) => {
    const deckCards = getDeckCards(name)
    const dueCount = getDueCards(name).length
    const allNew = deckCards.length > 0 && deckCards.every(c => !c.reps || c.reps === 0)
    const config = deckConfigs[name]
    const pinned = config?.pinned ?? false
    const deckColor = resolveDeckColor(config)
    const baseBorder = deckColor ? `color-mix(in srgb, ${deckColor} 55%, var(--border))` : 'var(--border)'
    const baseShadow = deckColor ? `inset 3px 0 0 ${deckColor}` : 'none'
    const focusedShadow = [deckColor ? baseShadow : '', '0 0 0 1px var(--accent-blue)'].filter(Boolean).join(', ')
    return (
      <div key={name} className="deck-card" style={{
        border: `1px solid ${borderColor || (selected.has(name) ? 'var(--accent-red)' : settings.vimMode && idx === focusIdx ? 'var(--accent-blue)' : baseBorder)}`,
        background: deckColor ? `color-mix(in srgb, ${deckColor} 9%, var(--surface-color))` : 'var(--surface-color)', padding: 20, borderRadius: 3,
        cursor: 'pointer', userSelect: 'none',
        opacity: 1,
        transition: 'border-color var(--speed), box-shadow var(--speed)',
        display: 'flex', flexDirection: 'column', gap: 16,
        boxShadow: settings.vimMode && idx === focusIdx ? focusedShadow : baseShadow,
      }}
        onClick={() => { if (selectMode) { const next = new Set(selected); if (next.has(name)) next.delete(name); else next.add(name); setSelected(next) } else onOpenDeck(name) }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, target: name }) }}
        onMouseEnter={e => { if (!settings.vimMode) { e.currentTarget.style.borderColor = deckColor || 'var(--border-active)'; if (settings.glowEffect) e.currentTarget.style.boxShadow = deckColor ? `${baseShadow}, 0 0 25px color-mix(in srgb, ${deckColor} 20%, transparent)` : '0 0 25px color-mix(in srgb, var(--accent) 10%, transparent)' } }}
        onMouseLeave={e => { if (!settings.vimMode) { e.currentTarget.style.borderColor = selected.has(name) ? 'var(--accent-red)' : baseBorder; if (settings.glowEffect) e.currentTarget.style.boxShadow = baseShadow } }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 10 }}>
            <DeckAppearance config={config} />
            <span style={{ overflow: 'hidden', fontSize: 18, fontWeight: 500, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span onClick={e => { e.stopPropagation(); togglePinDeck(name) }} style={{
              cursor: 'pointer', opacity: 0.6, transition: 'opacity var(--speed), color var(--speed)',
              display: 'flex', padding: 4,
            }} title={pinned ? t('decks.unpin') : t('decks.pin')}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
            >
              <PinIcon style={{ fontSize: 18, color: deckColor || (pinned ? 'var(--accent)' : 'var(--text-muted)'), fill: pinned ? (deckColor || 'var(--accent)') : 'currentColor', opacity: pinned ? 1 : 0.5 }} />
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{deckCards.length} {t('decks.cards')}</span>
          {deckCards.length === 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t('decks.emptyDeck')}</span>
          ) : allNew ? (
            <span className="deck-action" onClick={e => { e.stopPropagation(); setStudyConfirm(name) }} style={{ ...primaryBtn, borderColor: deckColor || 'var(--accent-blue)', color: deckColor || 'var(--accent-blue)', cursor: 'pointer' }}>{t('decks.study')}</span>
          ) : dueCount > 0 ? (
            <span className="deck-action" onClick={e => { e.stopPropagation(); setStudyConfirm(name) }} style={{ ...primaryBtn, borderColor: deckColor || 'var(--accent-blue)', color: deckColor || 'var(--accent-blue)', cursor: 'pointer' }}>{dueCount} {t('decks.review')}</span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--accent-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckIcon style={{ fontSize: 12 }} />{t('decks.done')}</span>
          )}
        </div>
      </div>
    )
  }

  const folderRow = (folder: { folder: string | null; decks: string[] }, globalIdx: number) => {
    const folderName = folder.folder
    if (!folderName) {
      return folder.decks.map((name, i) => deckCard(name, globalIdx + i))
    }
    const folderObj = folders.find(f => f.name === folderName)
    const collapsed = folderObj?.collapsed ?? false
    if (collapsed) {
      return (
        <div key={`f-${folderName}`} onClick={() => toggleFolderCollapsed(folderName)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer',
          borderBottom: '1px solid var(--border)', gridColumn: '1 / -1',
          color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1,
        }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, target: `__folder__${folderName}` }) }}>
          <ChevronRightIcon style={{ fontSize: 14 }} />
          <span>{folderName}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>({folder.decks.length})</span>
        </div>
      )
    }
    return (
      <div key={`f-${folderName}`} style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div onClick={() => toggleFolderCollapsed(folderName)} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', cursor: 'pointer',
          borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12,
          textTransform: 'uppercase', letterSpacing: 1,
        }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, target: `__folder__${folderName}` }) }}>
          <ChevronDownIcon style={{ fontSize: 14 }} />
          <span>{folderName}</span>
          <span style={{ fontSize: 10, opacity: 0.6 }}>({folder.decks.length})</span>
        </div>
        <div className="deck-grid" style={{
          display: 'grid', gap: 12,
          paddingLeft: 4, borderLeft: '1px solid var(--border)',
        }}>
          {folder.decks.map((name, i) => deckCard(name, globalIdx + i, 'var(--border)'))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}>
      <div onClick={onOpenStats} style={{
        border: '1px solid var(--border)', background: 'var(--surface)',
        padding: '16px 20px', fontSize: 12, color: 'var(--text-muted)', borderRadius: 3,
        display: 'flex', flexDirection: 'column', gap: 10,
        cursor: 'pointer',
        transition: 'border-color var(--speed), box-shadow var(--speed)',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; if (settings.glowEffect) e.currentTarget.style.boxShadow = '0 0 25px color-mix(in srgb, var(--accent) 10%, transparent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; if (settings.glowEffect) e.currentTarget.style.boxShadow = 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: 11 }}>{t('status.title')}</span>
        </div>
        <div>{t('status.due')}: {totalDue} / {cards.length}</div>
        <ProgressBar value={progressPct} height={6} borderRadius={3} transition="width 0.6s ease" glow="0 0 10px color-mix(in srgb, var(--accent) 30%, transparent)" />
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progressPct}% {t('status.learned')}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div ref={searchRef} style={{ position: 'relative', flex: 1, borderRadius: 3, transition: 'box-shadow var(--speed)' }}>
          <input
            ref={searchInputRef}
            type="text" placeholder={t('decks.search')} value={deckSearch}
            onChange={e => setDeckSearch(e.target.value)}
            onFocus={() => { if (searchRef.current) { searchRef.current.style.borderRadius = '3px'; if (settings.glowEffect) searchRef.current.style.boxShadow = '0 0 20px color-mix(in srgb, var(--accent) 18%, transparent)' } }}
            onBlur={() => { if (searchRef.current) { if (settings.glowEffect) searchRef.current.style.boxShadow = 'none' } }}
            style={{
              background: 'var(--bg-color)', border: '1px solid var(--border-color)',
              color: 'var(--text-main)', padding: '0 12px', fontFamily: 'var(--font-mono)',
              fontSize: 15, width: '100%', height: 38, outline: 'none', borderRadius: 3, boxSizing: 'border-box',
              caretColor: 'var(--accent)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {selectMode ? (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => { setSelected(new Set()); setSelectMode(false) }} style={{ ...secondaryBtn, height: 38, padding: '0 14px', fontSize: 12 }}>{t('decks.cancel')}</button>
              <button onClick={() => setDeleteSelectedOpen(true)} disabled={selected.size === 0} style={{ ...dangerBtn, opacity: selected.size === 0 ? 0.4 : 1 }}>
                {t('decks.delete')} ({selected.size})
              </button>
            </div>
          ) : (
            <button onClick={() => { setSelectMode(true); setDeleteAllDecksOpen(false); setDeleteAllCardsOpen(false) }} style={{ ...secondaryBtn, height: 38, padding: '0 14px', fontSize: 12, flexShrink: 0 }}>{t('decks.select')}</button>
          )}
          <button onClick={() => !selectMode && setCreateOpen(true)} style={{ ...primaryBtn, opacity: selectMode ? 0.4 : 1, cursor: selectMode ? 'default' : 'pointer' }} disabled={selectMode}>{t('decks.newDeck')}</button>
        </div>
      </div>

      {deckSearchLower ? (
        <div className="deck-grid" style={{
          display: 'grid', gap: 12,
        }}>
          {filteredDecks.length === 0 ? (
            <div key={deckSearch} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, border: '1px dashed var(--border-color)', gridColumn: '1 / -1' }}>
              {decks.length === 0 ? t('decks.empty') : t('decks.emptySearch')}
            </div>
          ) : filteredDecks.map((name, idx) => deckCard(name, idx))}
        </div>
      ) : (
        <div className="deck-grid" style={{
          display: 'grid', gap: 12,
        }}>
          {grouped.length === 0 || (grouped.length === 1 && grouped[0].decks.length === 0) ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32, border: '1px dashed var(--border-color)', gridColumn: '1 / -1' }}>
              {t('decks.empty')}
            </div>
          ) : (() => {
            let globalIdx = 0
            return grouped.flatMap(g => {
              const res = folderRow(g, globalIdx)
              globalIdx += g.decks.length
              return res
            })
          })()}
        </div>
      )}

      <Modal
        open={createOpen}
        title={t('createDeck.title')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{t('createDeck.name')}</span>
            <div className="input-glow-wrapper">
              <input
                type="text" placeholder={t('createDeck.name') + '...'} autoFocus
                value={deckName} onChange={e => setDeckName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                style={inputField}
              />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('createDeck.import')}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6, color: 'var(--text-muted)', fontSize: 10 }}>
                {t('createDeck.importDesc')}
              </span>
            </span>
            <input ref={fileRef} type="file" accept=".tsv,.csv,.txt" onChange={handleImportFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} style={{
              background: 'transparent', border: '1px dashed var(--border)', color: 'var(--text-muted)',
              padding: '10px', fontSize: 12, cursor: 'pointer', borderRadius: 3, textAlign: 'center',
              transition: 'border-color var(--speed), color var(--speed)',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {importCards.length > 0
                ? `${importCards.length} ${t('import.cards')}`
                : t('createDeck.chooseFile')}
            </button>
            {importCards.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}>
                {importCards.slice(0, 10).map((c, i) => (
                  <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{i + 1}.</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.q}</span>
                    <span style={{ color: 'var(--text-muted)' }}>→</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent-green)' }}>{c.a}</span>
                  </div>
                ))}
                {importCards.length > 10 && (
                  <div style={{ padding: '4px 0', color: 'var(--text-muted)', fontSize: 10 }}>...{t('decks.cards')} {importCards.length - 10}</div>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button onClick={() => { setCreateOpen(false); setDeckName(''); setImportCards([]) }} style={{
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
              height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
              cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
            }}>
              {t('modal.cancel')}
            </button>
            {onOpenAI && (
              <button onClick={() => { setCreateOpen(false); onOpenAI() }} style={{
                background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
                height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
                cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
              }}>
                AI
              </button>
            )}
            <button onClick={handleCreate} style={{
              background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)',
              height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
              cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
            }}>
              {importCards.length > 0 ? t('createDeck.createImport') : t('createDeck.create')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={studyConfirm !== null}
        title={studyConfirm && getDeckCards(studyConfirm).some(c => c.reps && c.reps > 0) ? t('studyConfirm.reviewTitle') : t('studyConfirm.newTitle')}
        confirmText={t('studyConfirm.start')}
        cancelText={t('modal.cancel')}
        onConfirm={() => { if (studyConfirm) onQuickStudy(studyConfirm); setStudyConfirm(null) }}
        onCancel={() => setStudyConfirm(null)}
      >
        <p>
          {studyConfirm && getDeckCards(studyConfirm).some(c => c.reps && c.reps > 0)
            ? `${t('study.reviewConfirm')} "${studyConfirm}"?`
            : `${t('study.startConfirm')} "${studyConfirm}"?`
          }
        </p>
      </Modal>

      <Modal open={createFolderOpen} title="New Folder" confirmText="Create" cancelText="Cancel"
        onConfirm={handleCreateFolder} onCancel={() => { setCreateFolderOpen(false); setFolderName('') }}>
        <input type="text" placeholder="Folder name..." autoFocus value={folderName}
          onChange={e => setFolderName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          style={inputField} />
      </Modal>

      <Modal open={renameFolderOpen !== null} title="Rename Folder" confirmText="Rename" cancelText="Cancel"
        onConfirm={handleRenameFolder} onCancel={() => setRenameFolderOpen(null)}>
        <input type="text" placeholder="Folder name..." autoFocus value={renameFolderValue}
          onChange={e => setRenameFolderValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
          style={inputField} />
      </Modal>

      <Modal open={deleteAllDecksOpen} title={t('deleteAllDecks.title')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger
        onConfirm={() => { deleteDecks(decks); setDeleteAllDecksOpen(false); setSelected(new Set()); setSelectMode(false) }}
        onCancel={() => setDeleteAllDecksOpen(false)}
      >
        <p>{t('deleteAllDecks.desc')}</p>
      </Modal>

      <Modal open={deleteAllCardsOpen} title={t('deleteAllCards.title')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger
        onConfirm={() => { deleteAllCards(); setDeleteAllCardsOpen(false); setSelected(new Set()); setSelectMode(false) }}
        onCancel={() => setDeleteAllCardsOpen(false)}
      >
        <p>{t('deleteAllCards.desc')}</p>
      </Modal>

      <Modal open={deleteSelectedOpen} title={t('deleteDecks.title')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger
        onConfirm={() => {
          const names = [...selected]
          setSelected(new Set())
          setSelectMode(false)
          setDeleteSelectedOpen(false)
          deleteDecks(names)
        }}
        onCancel={() => setDeleteSelectedOpen(false)}
      >
        <p>{t('deleteDecks.desc')} ({selected.size})</p>
      </Modal>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={
            ctxMenu.target?.startsWith('__folder__')
              ? (() => {
                  const fname = ctxMenu.target.replace('__folder__', '')
                  return [
                    { label: 'Rename Folder', onClick: () => { setRenameFolderValue(fname); setRenameFolderOpen(fname) } },
                    { label: 'Delete Folder', onClick: () => deleteFolder(fname), danger: true },
                  ]
                })()
              : ctxMenu.target
              ? [
                  { label: t('decks.study'), onClick: () => setStudyConfirm(ctxMenu.target!) },
                  { label: t('decks.pin'), onClick: () => togglePinDeck(ctxMenu.target!) },
                  { label: 'Move to folder', onClick: () => { setMoveDeckFolder(ctxMenu.target ?? null); setMoveFolderOpen(true) } },
                  { label: '-', onClick: () => {} },
                  { label: t('decks.select'), onClick: () => { setSelected(new Set([ctxMenu.target!])); setSelectMode(true) } },
                  { label: '-', onClick: () => {} },
                  { label: t('deckSettings.title'), onClick: () => setCtxDeckSettings(ctxMenu.target!) },
                  { label: t('decks.delete'), onClick: () => { setSelected(new Set([ctxMenu.target!])); setDeleteSelectedOpen(true) }, danger: true },
                ]
              : [
                  { label: t('decks.newDeck'), onClick: () => setCreateOpen(true) },
                  { label: 'New Folder', onClick: () => { setFolderName(''); setCreateFolderOpen(true) } },
                  { label: '-', onClick: () => {} },
                  ...(onOpenStats ? [{ label: t('status.stats'), onClick: () => onOpenStats() }] : []),
                  ...(onOpenSettings ? [{ label: 'Settings', onClick: () => onOpenSettings() }] : []),
                ]
          }
          onClose={() => setCtxMenu(null)}
        />
      )}

      <DeckSettingsModal deckName={ctxDeckSettings} onClose={() => setCtxDeckSettings(null)} onSaved={(n) => toast(`${t('deckSettings.saved')}: "${n}"`)} />

      {moveFolderOpen && moveDeckFolder && (
        <Modal open title={`Move "${moveDeckFolder}"`} onCancel={() => { setMoveFolderOpen(false); setMoveDeckFolder(null) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div onClick={() => handleMoveDeckToFolder(moveDeckFolder, null)} style={{
              padding: '10px 14px', cursor: 'pointer', borderRadius: 3, fontSize: 13,
              color: 'var(--text-muted)', transition: 'background var(--speed)',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}>
              — No folder
            </div>
            {folders.map(f => (
              <div key={f.name} onClick={() => handleMoveDeckToFolder(moveDeckFolder, f.name)} style={{
                padding: '10px 14px', cursor: 'pointer', borderRadius: 3, fontSize: 13,
                color: 'var(--text-muted)', transition: 'background var(--speed)',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--text-muted)' }}>
                {f.name}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
