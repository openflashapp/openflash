import { useState, useRef, useEffect } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { Modal } from './Modal'
import { DeckAppearance } from './DeckAppearance'
import { DeckAppearancePicker } from './DeckAppearancePicker'
import { inputField } from '../lib/styles'
import type { DeckConfig } from '../types'

interface Props {
  deckName: string | null
  onClose: () => void
  onSaved?: (name: string) => void
}

export function DeckSettingsModal({ deckName, onClose, onSaved }: Props) {
  const { t } = useLocale()
  const { getDeckConfig, updateDeckConfig } = useFlashStore()
  const [actionOpen, setActionOpen] = useState(false)
  const actionRef = useRef<HTMLDivElement>(null)

  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [form, setForm] = useState<{ steps: string; maxInterval: string; leechThreshold: string; leechAction: 'mark' | 'suspend'; newPerDay: string; reviewPerDay: string }>({
    steps: '', maxInterval: '', leechThreshold: '', leechAction: 'mark', newPerDay: '', reviewPerDay: '',
  })

  useEffect(() => {
    if (deckName) {
      const cfg = getDeckConfig(deckName) || { pinned: false }
      setForm({
        steps: cfg.steps?.join(', ') || '',
        maxInterval: cfg.maxInterval?.toString() || '',
        leechThreshold: cfg.leechThreshold?.toString() || '',
        leechAction: cfg.leechAction || 'mark',
        newPerDay: cfg.newPerDay?.toString() || '',
        reviewPerDay: cfg.reviewPerDay?.toString() || '',
      })
    }
  }, [deckName, getDeckConfig])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (actionOpen && actionRef.current && !actionRef.current.contains(e.target as Node)) setActionOpen(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [actionOpen])

  const handleSave = () => {
    if (!deckName) return
    const parsed: Partial<DeckConfig> = {}
    if (form.steps.trim()) {
      const nums = form.steps.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0)
      if (nums.length > 0) parsed.steps = nums
    }
    if (form.maxInterval.trim()) {
      const n = parseInt(form.maxInterval, 10)
      if (!isNaN(n) && n > 0) parsed.maxInterval = n
    }
    if (form.leechThreshold.trim()) {
      const n = parseInt(form.leechThreshold, 10)
      if (!isNaN(n) && n > 0) parsed.leechThreshold = n
    }
    parsed.leechAction = form.leechAction
    if (form.newPerDay.trim()) {
      const n = parseInt(form.newPerDay, 10)
      if (!isNaN(n) && n > 0) parsed.newPerDay = n
    }
    if (form.reviewPerDay.trim()) {
      const n = parseInt(form.reviewPerDay, 10)
      if (!isNaN(n) && n > 0) parsed.reviewPerDay = n
    }
    updateDeckConfig(deckName, parsed)
    onSaved?.(deckName)
    onClose()
  }

  return (
    <>
      <Modal open={deckName !== null} title={`${t('deckSettings.title')}: ${deckName}`} confirmText={t('deckSettings.save')} cancelText={t('modal.cancel')}
        onConfirm={handleSave}
        onCancel={() => { setAppearanceOpen(false); onClose() }}
      >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button type="button" onClick={() => setAppearanceOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 3, background: 'transparent', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
          <DeckAppearance config={deckName ? getDeckConfig(deckName) : undefined} size={36} />
          <span>{t('deckSettings.appearance')}</span>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('deckSettings.steps')}
          </span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder="1, 3" value={form.steps}
              onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} style={inputField} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('deckSettings.maxInterval')}
          </span>
          <div className="input-glow-wrapper">
            <input type="text" placeholder="365" value={form.maxInterval}
              onChange={e => setForm(f => ({ ...f, maxInterval: e.target.value }))} style={inputField} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('deckSettings.leechThreshold')}
            </span>
            <div className="input-glow-wrapper">
              <input type="text" placeholder="8" value={form.leechThreshold}
                onChange={e => setForm(f => ({ ...f, leechThreshold: e.target.value }))} style={inputField} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('deckSettings.leechAction')}
            </span>
            <div ref={actionRef} style={{ position: 'relative' }}>
              <button onClick={() => setActionOpen(o => !o)} style={{
                ...inputField, cursor: 'pointer', textAlign: 'left',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
              }}>
                <span>{form.leechAction === 'mark' ? t('deckSettings.leechMark') : t('deckSettings.leechSuspend')}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>▾</span>
              </button>
              {actionOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                  borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  animation: 'fadeIn 0.1s ease-out',
                }}>
                  {(['mark', 'suspend'] as const).map(val => (
                    <div key={val} onClick={() => { setForm(f => ({ ...f, leechAction: val })); setActionOpen(false) }} style={{
                      padding: '10px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-muted)',
                      background: form.leechAction === val ? 'var(--surface-hover)' : 'transparent',
                      transition: 'background var(--speed)',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = form.leechAction === val ? 'var(--surface-hover)' : 'transparent'}>
                      {val === 'mark' ? t('deckSettings.leechMark') : t('deckSettings.leechSuspend')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('deckSettings.newPerDay')}
            </span>
            <div className="input-glow-wrapper">
              <input type="text" placeholder={t('deckSettings.unlimited')} value={form.newPerDay}
                onChange={e => setForm(f => ({ ...f, newPerDay: e.target.value }))} style={inputField} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {t('deckSettings.reviewPerDay')}
            </span>
            <div className="input-glow-wrapper">
              <input type="text" placeholder={t('deckSettings.unlimited')} value={form.reviewPerDay}
                onChange={e => setForm(f => ({ ...f, reviewPerDay: e.target.value }))} style={inputField} />
            </div>
          </div>
        </div>
      </div>
      </Modal>
      <DeckAppearancePicker deckName={appearanceOpen ? deckName : null} onClose={() => setAppearanceOpen(false)} />
    </>
  )
}
