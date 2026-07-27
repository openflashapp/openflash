import { useState, useRef, useEffect } from 'react'
import { useLocale, LOCALES } from '../lib/i18n'
import { FlashLogo, GearIcon, PaletteIcon, LibraryIcon, ChartIcon, CheckIcon, GlobeIcon, UserIcon } from './Icons'

interface HeaderProps {
  onSettings: () => void
  onHome: () => void
  onAccount: () => void
  onThemes: () => void
  onDeckStore: () => void
  onStats: () => void
}

export function Header({ onSettings, onHome, onAccount, onThemes, onDeckStore, onStats }: HeaderProps) {
  const { t, locale, setLocale } = useLocale()
  const [localeMenuOpen, setLocaleMenuOpen] = useState(false)
  const localeMenuRef = useRef<HTMLDivElement>(null)
  const localeBtnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (localeMenuOpen && !localeMenuRef.current?.contains(e.target as Node) && !localeBtnRef.current?.contains(e.target as Node)) {
        setLocaleMenuOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [localeMenuOpen])

  return (
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 24px 20px' }}>
      <div onClick={onHome} style={{
        display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none', cursor: 'pointer',
        transition: 'opacity var(--speed)',
      }}
        >
        <FlashLogo style={{ width: 'clamp(112px, 13vw, 152px)', height: 'auto' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button ref={localeBtnRef} onClick={() => setLocaleMenuOpen(o => !o)} style={{
            background: 'transparent', border: '1px solid var(--border-color)',
            color: 'var(--text-muted)', height: 38, padding: '0 12px',
            fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 3,
            cursor: 'pointer', textTransform: 'uppercase',
          }}>
            <GlobeIcon style={{ fontSize: 14, marginRight: 4 }} />{locale.toUpperCase()}
          </button>
          {localeMenuOpen && (
            <div ref={localeMenuRef} style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--surface-color)', border: '1px solid var(--border-color)',
              borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
              zIndex: 100, minWidth: 160, display: 'flex', flexDirection: 'column',
              padding: '6px 0', animation: 'fadeIn 0.12s ease-out',
            }}>
              {LOCALES.map(({ code, label }) => (
                <div key={code} onClick={() => { setLocale(code); setLocaleMenuOpen(false) }} style={{
                  padding: '10px 16px', cursor: 'pointer', fontSize: 12,
                  textTransform: 'uppercase', transition: 'background var(--speed), color var(--speed)',
                  textAlign: 'left', color: 'var(--text-muted)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  ...(locale === code ? { color: 'var(--text)', background: 'var(--surface-hover)' } : {}),
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = locale === code ? 'var(--text)' : 'var(--text-muted)' }}>
                  <span>{label}</span>
                  {locale === code && <CheckIcon style={{ color: 'var(--accent-blue)', fontSize: 16 }} />}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onDeckStore} style={btnStyle} aria-label={t('catalog.title')} title={t('catalog.title')}><LibraryIcon style={{ fontSize: 19 }} /></button>
        <button type="button" onClick={onThemes} style={btnStyle} aria-label={t('theme')} title={t('theme')}><PaletteIcon style={{ fontSize: 20 }} /></button>
        <button type="button" onClick={onStats} style={btnStyle} aria-label={t('status.stats')} title={t('status.stats')}><ChartIcon style={{ fontSize: 19 }} /></button>
        <button onClick={onSettings} style={btnStyle}><GearIcon style={{ fontSize: 20 }} /></button>
        <button onClick={onAccount} style={btnStyle}><UserIcon style={{ fontSize: 20 }} /></button>
      </div>
    </header>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
  height: 38, width: 38, padding: 0, fontFamily: 'var(--font-mono)', fontSize: 16,
  cursor: 'pointer', borderRadius: 3, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
