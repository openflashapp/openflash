import { CheckIcon } from '../components/Icons'
import { ADDED_COLOR_THEME_IDS, THEME_IDS, THEME_META } from '../config/themes'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { secondaryBtn } from '../lib/styles'

interface Props {
  onBack: () => void
}

export function ThemesScreen({ onBack }: Props) {
  const { t } = useLocale()
  const { theme, setTheme } = useFlashStore()

  const renderThemes = (themeIds: readonly typeof THEME_IDS[number][]) => themeIds.map(key => {
    const { label, preview } = THEME_META[key]
    const active = theme === key
    return (
      <button
        key={key}
        onClick={() => setTheme(key)}
        style={{
          display: 'flex', flexDirection: 'column', gap: 12,
          padding: 16, borderRadius: 3, cursor: 'pointer',
          background: 'var(--surface)',
          border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
          transition: 'border-color var(--speed), background var(--speed)',
          textAlign: 'left', fontFamily: 'var(--font-mono)',
        }}
        onMouseEnter={event => { event.currentTarget.style.background = 'var(--surface-hover)' }}
        onMouseLeave={event => { event.currentTarget.style.background = 'var(--surface)' }}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr',
          gap: 2, borderRadius: 3, overflow: 'hidden', width: '100%', aspectRatio: '2 / 1',
        }}>
          <div style={{ background: preview.bg }} />
          <div style={{ background: preview.surface }} />
          <div style={{ background: preview.accent }} />
          <div style={{ background: preview.text }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {label}
          </span>
          {active && <CheckIcon style={{ color: 'var(--accent)', fontSize: 14 }} />}
        </div>
      </button>
    )
  })

  return (
    <div className="themes-screen">
      <header className="page-heading">
        <h1>{t('themes.title')}</h1>
        <button onClick={onBack} style={secondaryBtn}>{t('nav.back')}</button>
      </header>

      <div className="themes-grid">
        {renderThemes(THEME_IDS.filter(key => !ADDED_COLOR_THEME_IDS.includes(key)))}
        {renderThemes(ADDED_COLOR_THEME_IDS)}
      </div>
    </div>
  )
}
