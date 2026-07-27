import { useLocale } from '../lib/i18n'
import { AnimatedNumber } from '../components/AnimatedNumber'
import { ProgressBar } from '../components/ProgressBar'
import type { SessionStats } from '../types'

interface Props {
  stats: SessionStats
  onFinish: () => void
}

export function SummaryScreen({ stats, onFinish }: Props) {
  const { t } = useLocale()
  const elapsed = Math.floor((stats.endTime - stats.startTime) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  const maxRating = Math.max(...Object.values(stats.ratings), 1)

  const labels: Record<number, string> = { 1: t('study.again'), 2: t('study.hard'), 3: t('study.good'), 4: t('study.easy') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{
        border: '1px solid var(--border)', background: 'var(--surface)',
        padding: '36px 32px', display: 'flex', flexDirection: 'column', gap: 28, borderRadius: 3,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
            {t('summary.title')}
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{t('summary.time')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, color: 'var(--text)' }}>
              {mins}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>{'m'} </span>
              {secs}<span style={{ fontSize: 16, color: 'var(--text-muted)' }}>{'s'}</span>
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{t('summary.cards')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, color: 'var(--accent)' }}>
              <AnimatedNumber value={stats.cardCount} />
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, whiteSpace: 'nowrap' }}>{t('summary.ratings')}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {([1, 2, 3, 4] as const).map(g => {
                const count = stats.ratings[g] || 0
                const pct = maxRating > 0 ? (count / maxRating) * 100 : 0
                return (
                  <div key={g}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{labels[g]}</span>
                      <span style={{ color: 'var(--text)' }}>{count}</span>
                    </div>
                    <ProgressBar value={pct} height={6} borderRadius={3} transition="width 0.8s ease" />
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <button onClick={onFinish} style={{
        background: 'transparent', border: '1px solid var(--accent)', color: 'var(--accent)',
        height: 42, padding: '0 24px', fontFamily: 'var(--font-mono)', fontSize: 13,
        cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all var(--speed)',
      }}>
        {t('summary.finish')}
      </button>
    </div>
  )
}
