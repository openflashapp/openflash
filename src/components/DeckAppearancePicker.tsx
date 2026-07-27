import { useEffect, useState } from 'react'
import { DECK_COLOR_IDS, DECK_COLOR_VALUES, DECK_EMOJIS, DECK_ICON_IDS, type DeckColor, type DeckIcon } from '../config/deckAppearance'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { DeckAppearance } from './DeckAppearance'
import { Modal } from './Modal'
import { ToggleSwitch } from './ToggleSwitch'

interface Props {
  deckName: string | null
  onClose: () => void
}

export function DeckAppearancePicker({ deckName, onClose }: Props) {
  const { t } = useLocale()
  const { getDeckConfig, updateDeckConfig } = useFlashStore()
  const [tab, setTab] = useState<'emoji' | 'icon'>('emoji')
  const [emoji, setEmoji] = useState<string | undefined>()
  const [icon, setIcon] = useState<DeckIcon | undefined>()
  const [color, setColor] = useState<DeckColor | undefined>()
  const [customColor, setCustomColor] = useState<string | undefined>()
  const [colorizeInterface, setColorizeInterface] = useState(false)

  useEffect(() => {
    if (!deckName) return
    const config = getDeckConfig(deckName)
    setEmoji(config?.emoji)
    setIcon(config?.icon)
    setColor(config?.color)
    setCustomColor(config?.customColor)
    setColorizeInterface(config?.colorizeInterface === true)
  }, [deckName, getDeckConfig])

  return (
    <Modal
      open={deckName !== null}
      title={t('deckSettings.appearance')}
      confirmText={t('deckSettings.save')}
      cancelText={t('modal.cancel')}
      onConfirm={() => {
        if (!deckName) return false
        updateDeckConfig(deckName, { emoji, icon, color, customColor, colorizeInterface })
        onClose()
      }}
      onCancel={onClose}
    >
      <div className="appearance-picker">
        <div className="appearance-picker-preview">
          <DeckAppearance config={{ emoji, icon, color, customColor }} size={44} />
          <span>{deckName}</span>
          <button type="button" className="appearance-picker-reset" onClick={() => { setEmoji(undefined); setIcon(undefined); setColor(undefined); setCustomColor(undefined); setColorizeInterface(false) }}>Reset to default</button>
        </div>
        <div className="appearance-picker-tabs">
          <button type="button" className={tab === 'emoji' ? 'is-active' : ''} onClick={() => setTab('emoji')}>{t('deckSettings.emojis')}</button>
          <button type="button" className={tab === 'icon' ? 'is-active' : ''} onClick={() => setTab('icon')}>{t('deckSettings.icons')}</button>
        </div>
        <div className="appearance-picker-grid">
          {tab === 'emoji' ? DECK_EMOJIS.map(item => (
            <button key={item} type="button" aria-label={item} className={emoji === item ? 'is-selected' : ''} onClick={() => { setEmoji(item); setIcon(undefined) }}>
              {item}
            </button>
          )) : DECK_ICON_IDS.map(item => (
            <button key={item} type="button" aria-label={item} className={icon === item ? 'is-selected' : ''} onClick={() => { setIcon(item); setEmoji(undefined) }}>
              <DeckAppearance config={{ icon: item, color, customColor }} size={24} />
            </button>
          ))}
        </div>
        <span className="appearance-picker-label">{t('deckSettings.color')}</span>
        <div className="appearance-picker-colors">
          {DECK_COLOR_IDS.map(item => (
            <button key={item} type="button" aria-label={item} className={!customColor && color === item ? 'is-selected' : ''}
              onClick={() => { setColor(item); setCustomColor(undefined) }} style={{ background: DECK_COLOR_VALUES[item] }} />
          ))}
          <label className={`appearance-picker-custom-color${customColor ? ' is-selected' : ''}`} title="Custom color">
            <input type="color" value={customColor || (color ? DECK_COLOR_VALUES[color] : '#8b95a5')} onChange={event => setCustomColor(event.target.value)} />
          </label>
        </div>
        <ToggleSwitch checked={colorizeInterface} label={t('deckSettings.colorizeInterface')} description={t('deckSettings.colorizeInterfaceDesc')} onChange={setColorizeInterface} className="form-toggle" />
      </div>
    </Modal>
  )
}
