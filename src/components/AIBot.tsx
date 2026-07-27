import { useState, useRef, useEffect } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { generateCards, buildPrompt, type AICard, type GenerateOptions } from '../lib/ai'
import { Modal } from './Modal'
import { inputField, primaryBtn, secondaryBtn } from '../lib/styles'
import { ToggleSwitch } from './ToggleSwitch'
import { ChoiceOption } from './ChoiceOption'
import { CheckIcon, ChevronDownIcon } from './Icons'
import { AI_PROVIDER_IDS, AI_PROVIDERS } from '../config/ai'
import type { AIProviderId } from '../types'

interface Props {
  open: boolean
  onClose: () => void
  toast: (msg: string, err?: boolean) => void
}

const TEMPLATE_KEYS = ['vocabulary', 'phrases', 'grammar', 'conversation', 'custom'] as const

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Portuguese', 'Russian',
  'Chinese', 'Japanese', 'Korean', 'Italian', 'Arabic', 'Hindi',
  'Dutch', 'Polish', 'Turkish', 'Swedish', 'Norwegian', 'Danish',
  'Finnish', 'Czech', 'Romanian', 'Hungarian', 'Greek', 'Hebrew',
  'Thai', 'Vietnamese', 'Indonesian', 'Malay', 'Ukrainian',
] as const

export function AIBot({ open, onClose, toast }: Props) {
  const { t } = useLocale()
  const { addCards, addDeck, getDecks, settings, setSettings } = useFlashStore()
  const [mode, setMode] = useState<'language' | 'custom'>(settings.aiForm.mode === 'language' ? 'language' : 'custom')
  const [nativeLang, setNativeLang] = useState(settings.aiForm.nativeLang)
  const [targetLang, setTargetLang] = useState(settings.aiForm.targetLang)
  const [template, setTemplate] = useState<string>(settings.aiForm.template)
  const [topic, setTopic] = useState('')
  const [withTR, setWithTR] = useState(settings.aiForm.withTranscription)
  const [trPlacement, setTrPlacement] = useState<'question' | 'answer'>(settings.aiForm.transcriptionPlacement)
  const [trLang, setTrLang] = useState<'target' | 'latin'>(settings.aiForm.transcriptionLang)
  const [genProvider, setGenProvider] = useState<AIProviderId>(settings.activeProvider)
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const providerBtnRef = useRef<HTMLButtonElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const [deckMenuOpen, setDeckMenuOpen] = useState(false)
  const deckBtnRef = useRef<HTMLButtonElement>(null)
  const deckMenuRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [cards, setCards] = useState<AICard[]>([])
  const [suggestedDeck, setSuggestedDeck] = useState('')
  const [deck, setDeck] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const [nativeMenuOpen, setNativeMenuOpen] = useState(false)
  const [targetMenuOpen, setTargetMenuOpen] = useState(false)
  const nativeBtnRef = useRef<HTMLButtonElement>(null)
  const targetBtnRef = useRef<HTMLButtonElement>(null)
  const nativeMenuRef = useRef<HTMLDivElement>(null)
  const targetMenuRef = useRef<HTMLDivElement>(null)

  const decks = getDecks()
  const configuredProviders = AI_PROVIDER_IDS.filter(id => AI_PROVIDERS[id].requiresApiKey === false || settings.providers[id].apiKey)
  const includeTranscription = mode === 'language' && withTR

  useEffect(() => {
    if (open) setMode(settings.aiForm.mode === 'language' ? 'language' : 'custom')
  }, [open, settings.aiForm.mode])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (deckMenuOpen && !deckMenuRef.current?.contains(e.target as Node) && !deckBtnRef.current?.contains(e.target as Node)) {
        setDeckMenuOpen(false)
      }
      if (nativeMenuOpen && !nativeMenuRef.current?.contains(e.target as Node) && !nativeBtnRef.current?.contains(e.target as Node)) {
        setNativeMenuOpen(false)
      }
      if (targetMenuOpen && !targetMenuRef.current?.contains(e.target as Node) && !targetBtnRef.current?.contains(e.target as Node)) {
        setTargetMenuOpen(false)
      }
      if (providerMenuOpen && !providerMenuRef.current?.contains(e.target as Node) && !providerBtnRef.current?.contains(e.target as Node)) {
        setProviderMenuOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [deckMenuOpen, nativeMenuOpen, targetMenuOpen, providerMenuOpen])

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast(mode === 'custom' ? 'Enter a prompt' : 'Enter a topic', true)
      return
    }
    if (mode === 'language' && !targetLang.trim()) {
      toast('Enter the target language', true)
      return
    }
    setLoading(true)
    setCards([])
    setShowCreate(false)
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setSettings({
      ...settings,
      aiForm: {
        mode,
        nativeLang: nativeLang.trim(),
        targetLang: targetLang.trim(),
        template,
        withTranscription: withTR,
        transcriptionPlacement: trPlacement,
        transcriptionLang: trLang,
      },
    })

    const opts: GenerateOptions = {
      nativeLang: nativeLang.trim() || 'English',
      targetLang: targetLang.trim(),
      template,
      topic: topic.trim(),
      withTranscription: includeTranscription,
      transcriptionPlacement: trPlacement,
      transcriptionLang: trLang,
    }

    try {
      const providerCfg = settings.providers[genProvider]
      const { deck: suggested, cards: generated } = await generateCards(genProvider, providerCfg, opts, controller.signal)
      setCards(generated)
      if (!decks.some(d => d.toLowerCase() === (suggested || '').toLowerCase())) {
        setSuggestedDeck(suggested || '')
        setShowCreate(true)
        setDeck('')
      } else {
        setDeck(suggested || '')
        setShowCreate(false)
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      toast((e as Error).message, true)
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    const target = deck || suggestedDeck
    if (!target || cards.length === 0) return
    if (!decks.some(d => d.toLowerCase() === target.toLowerCase())) {
      addDeck(target)
    }
    addCards(target, cards.map(c => ({
      question: c.question,
      answer: c.answer,
      transcription: c.transcription,
      transcriptionPlacement: trPlacement,
    })))
    toast(`${cards.length} cards added to "${target}"`)
    handleClose()
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setSettings({
      ...settings,
      aiForm: {
        mode,
        nativeLang: nativeLang.trim(),
        targetLang: targetLang.trim(),
        template,
        withTranscription: withTR,
        transcriptionPlacement: trPlacement,
        transcriptionLang: trLang,
      },
    })
    setTopic('')
    setCards([])
    setSuggestedDeck('')
    setDeck('')
    setShowCreate(false)
    setLoading(false)
    onClose()
  }

  return (
    <Modal open={open} title={t('ai.title')} size="wide" onCancel={handleClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div role="tablist" aria-label="Generation mode" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['custom', 'language'] as const).map(option => {
            const active = mode === option
            const label = option === 'language' ? 'Изучение языка' : 'Свой запрос'
            return (
              <button
                type="button"
                key={option}
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setMode(option)
                  if (option === 'custom') {
                    setTemplate('custom')
                  } else if (option === 'language' && template === 'custom') {
                    setTemplate('vocabulary')
                  }
                }}
                style={{
                  ...(active ? primaryBtn : secondaryBtn),
                  padding: '6px 12px', fontSize: 11, height: 30,
                }}
              >
                {active && <CheckIcon style={{ fontSize: 11, marginRight: 4 }} />}
                {label}
              </button>
            )
          })}
        </div>

        {mode === 'language' ? (
          <>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Native</span>
                <div style={{ position: 'relative' }}>
                  <button ref={nativeBtnRef} onClick={() => { setNativeMenuOpen(o => !o); setTargetMenuOpen(false) }} style={{
                    background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                    color: nativeLang ? 'var(--text-main)' : 'var(--text-muted)',
                    height: 38, padding: '0 12px', width: '100%',
                    fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 3,
                    cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {nativeLang || 'e.g. English'}
                    </span>
                    <ChevronDownIcon style={{ fontSize: 14, flexShrink: 0, opacity: 0.6 }} />
                  </button>
                  {nativeMenuOpen && (
                    <div ref={nativeMenuRef} style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                      borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 100, maxHeight: 200, overflowY: 'auto',
                      padding: '4px 0', animation: 'fadeIn 0.1s ease-out',
                    }}>
                      {LANGUAGES.map(lang => (
                        <div key={lang} onClick={() => { setNativeLang(lang); setNativeMenuOpen(false) }} style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          color: nativeLang === lang ? 'var(--text)' : 'var(--text-muted)',
                          background: nativeLang === lang ? 'var(--surface-hover)' : 'transparent',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = nativeLang === lang ? 'var(--text)' : 'var(--text-muted)' }}>
                          <span>{lang}</span>
                          {nativeLang === lang && <CheckIcon style={{ color: 'var(--accent)', fontSize: 14 }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Target</span>
                <div style={{ position: 'relative' }}>
                  <button ref={targetBtnRef} onClick={() => { setTargetMenuOpen(o => !o); setNativeMenuOpen(false) }} style={{
                    background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                    color: targetLang ? 'var(--text-main)' : 'var(--text-muted)',
                    height: 38, padding: '0 12px', width: '100%',
                    fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 3,
                    cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {targetLang || 'e.g. Spanish'}
                    </span>
                    <ChevronDownIcon style={{ fontSize: 14, flexShrink: 0, opacity: 0.6 }} />
                  </button>
                  {targetMenuOpen && (
                    <div ref={targetMenuRef} style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                      borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                      zIndex: 100, maxHeight: 200, overflowY: 'auto',
                      padding: '4px 0', animation: 'fadeIn 0.1s ease-out',
                    }}>
                      {LANGUAGES.map(lang => (
                        <div key={lang} onClick={() => { setTargetLang(lang); setTargetMenuOpen(false) }} style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          color: targetLang === lang ? 'var(--text)' : 'var(--text-muted)',
                          background: targetLang === lang ? 'var(--surface-hover)' : 'transparent',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = targetLang === lang ? 'var(--text)' : 'var(--text-muted)' }}>
                          <span>{lang}</span>
                          {targetLang === lang && <CheckIcon style={{ color: 'var(--accent)', fontSize: 14 }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATE_KEYS.map(key => {
                const active = template === key
                const labels: Record<string, string> = {
                  vocabulary: 'Vocabulary',
                  phrases: 'Phrases',
                  grammar: 'Grammar',
                  conversation: 'Conversation',
                  custom: 'Custom',
                }
                return (
                    <button type="button" key={key} aria-pressed={active} onClick={() => setTemplate(key)} style={{
                    ...(active ? primaryBtn : secondaryBtn),
                    padding: '6px 12px', fontSize: 11, height: 30,
                  }}>
                    {active && <CheckIcon style={{ fontSize: 11, marginRight: 4 }} />}
                    {labels[key]}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}

        {(configuredProviders.length > 1 || mode === 'language') && (
          <div className="ai-generator-options">
          {configuredProviders.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Provider</span>
            <div style={{ position: 'relative' }}>
              <button ref={providerBtnRef} onClick={() => { setProviderMenuOpen(o => !o); setNativeMenuOpen(false); setTargetMenuOpen(false) }} style={{
                background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                color: 'var(--text-main)',
                height: 34, padding: '0 12px', width: '100%',
                fontFamily: 'var(--font-mono)', fontSize: 12, borderRadius: 3,
                cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}>
                <span>{AI_PROVIDERS[genProvider].name}</span>
                <ChevronDownIcon style={{ fontSize: 14, flexShrink: 0, opacity: 0.6 }} />
              </button>
              {providerMenuOpen && (
                <div ref={providerMenuRef} style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                  background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                  borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  zIndex: 100, display: 'flex', flexDirection: 'column',
                  padding: '4px 0', animation: 'fadeIn 0.1s ease-out',
                }}>
                  {configuredProviders.map(id => (
                    <div key={id} onClick={() => { setGenProvider(id); setProviderMenuOpen(false) }} style={{
                      padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                      color: genProvider === id ? 'var(--text)' : 'var(--text-muted)',
                      background: genProvider === id ? 'var(--surface-hover)' : 'transparent',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = genProvider === id ? 'var(--text)' : 'var(--text-muted)' }}>
                      <span>{AI_PROVIDERS[id].name}</span>
                      {genProvider === id && <CheckIcon style={{ color: 'var(--accent)', fontSize: 14 }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

          {mode === 'language' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleSwitch checked={withTR} label="Include pronunciation" onChange={setWithTR} className="form-toggle" />
          {withTR && (
            <><div className="ui-choice-group" style={{ marginLeft: 24 }}>
              <ChoiceOption checked={trPlacement === 'question'} label="In question" onChange={() => setTrPlacement('question')} />
              <ChoiceOption checked={trPlacement === 'answer'} label="In answer" onChange={() => setTrPlacement('answer')} />
            </div>
            <div className="ui-choice-group" style={{ marginLeft: 24, marginTop: 4 }}>
              <ChoiceOption checked={trLang === 'target'} label="Target script" onChange={() => setTrLang('target')} />
              <ChoiceOption checked={trLang === 'latin'} label="Latin script" onChange={() => setTrLang('latin')} />
            </div></>
          )}
          </div>}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Prompt
          </span>
          <div className="input-glow-wrapper">
            <textarea
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={mode === 'custom'
                ? 'Write your custom prompt for the AI...'
                : `e.g. ${template === 'vocabulary' ? 'food and cooking' : template === 'phrases' ? 'introductions' : template === 'grammar' ? 'past tense' : template === 'conversation' ? 'ordering at a restaurant' : '...'}`}
              rows={4}
              style={{ ...inputField, resize: 'vertical', padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.5 }}
            />
          </div>
        </div>

        {mode === 'language' && <div style={{
          padding: '8px 10px', background: 'var(--bg)', borderRadius: 3,
          border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)',
          lineHeight: 1.6, maxHeight: 80, overflowY: 'auto',
        }}>
          <span style={{ color: 'var(--accent)' }}>$</span> {buildPrompt({
            nativeLang: nativeLang || 'English',
            targetLang: targetLang || 'the target language',
            template,
            topic: topic || 'your topic',
            withTranscription: withTR,
            transcriptionPlacement: trPlacement,
            transcriptionLang: trLang,
          }).slice(0, 200)}
          {buildPrompt({ nativeLang: nativeLang || 'English', targetLang: targetLang || 'the target language', template, topic: topic || 'your topic', withTranscription: withTR, transcriptionPlacement: trPlacement, transcriptionLang: trLang }).length > 200 && '...'}
        </div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleGenerate}
            disabled={loading || !topic.trim() || (mode === 'language' && !targetLang.trim())}
            style={{
              ...primaryBtn,
              opacity: loading || !topic.trim() || (mode === 'language' && !targetLang.trim()) ? 0.5 : 1,
              cursor: loading || !topic.trim() || (mode === 'language' && !targetLang.trim()) ? 'not-allowed' : 'pointer',
              flex: 1,
            }}
          >
            {loading ? t('ai.generating') : t('ai.generate')}
          </button>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0' }}>
            <div style={{
              width: 16, height: 16, border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)', borderRadius: '50%',
              animation: 'spin 0.6s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('ai.generating')}...</span>
          </div>
        )}

        {cards.length > 0 && (
          <>
            <div style={{ height: 1, background: 'var(--border)' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('ai.preview')} ({cards.length})
              </span>
              <div style={{
                maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6,
                border: '1px solid var(--border)', borderRadius: 3, padding: 10,
              }}>
                {cards.map((card, i) => (
                  <div key={i} style={{
                    fontSize: 12, padding: '6px 8px', background: 'var(--bg)',
                    borderRadius: 3, borderLeft: '2px solid var(--accent)',
                  }}>
                    <div style={{ color: 'var(--text)', fontWeight: 500 }}>{card.question}</div>
                    {card.transcription && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic' }}>[{card.transcription}]</div>
                    )}
                    <div style={{ color: 'var(--text-muted)', marginTop: card.transcription ? 1 : 2 }}>{card.answer}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('ai.deck')}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                {showCreate ? (
                  <div className="input-glow-wrapper" style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={deck || suggestedDeck}
                      onChange={e => setDeck(e.target.value)}
                      placeholder={suggestedDeck}
                      style={{ ...inputField, height: 38, padding: '0 12px', fontSize: 13 }}
                    />
                  </div>
                ) : (
                  <div style={{ position: 'relative', flex: 1 }}>
                    <button
                      ref={deckBtnRef}
                      onClick={() => setDeckMenuOpen(o => !o)}
                      style={{
                        background: 'var(--bg-color)', border: '1px solid var(--border-color)',
                        color: deck ? 'var(--text-main)' : 'var(--text-muted)',
                        height: 38, padding: '0 12px', width: '100%',
                        fontFamily: 'var(--font-mono)', fontSize: 13, borderRadius: 3,
                        cursor: 'pointer', textTransform: 'none', letterSpacing: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {deck || (t('ai.selectDeck') as string)}
                      </span>
                      <ChevronDownIcon style={{ fontSize: 16, flexShrink: 0, opacity: 0.6 }} />
                    </button>
                    {deckMenuOpen && (
                      <div ref={deckMenuRef} style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                        background: 'var(--surface-color)', border: '1px solid var(--border-color)',
                        borderRadius: 3, boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                        zIndex: 100, maxHeight: 200, overflowY: 'auto',
                        padding: '4px 0', animation: 'fadeIn 0.1s ease-out',
                      }}>
                        <div onClick={() => { setDeck(''); setDeckMenuOpen(false) }} style={{
                          padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                          color: !deck ? 'var(--text)' : 'var(--text-muted)',
                          background: !deck ? 'var(--surface-hover)' : 'transparent',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = !deck ? 'var(--text)' : 'var(--text-muted)' }}>
                          <span>— {t('ai.selectDeck') as string}</span>
                        </div>
                        {decks.map(d => (
                          <div key={d} onClick={() => { setDeck(d); setDeckMenuOpen(false) }} style={{
                            padding: '8px 12px', cursor: 'pointer', fontSize: 12,
                            color: deck === d ? 'var(--text)' : 'var(--text-muted)',
                            background: deck === d ? 'var(--surface-hover)' : 'transparent',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = 'var(--text)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = deck === d ? 'var(--text)' : 'var(--text-muted)' }}>
                            <span>{d}</span>
                            {deck === d && <CheckIcon style={{ color: 'var(--accent)', fontSize: 14 }} />}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { setShowCreate(!showCreate); if (!showCreate) setDeck('') }}
                  style={{ ...secondaryBtn, height: 38, flexShrink: 0 }}
                >
                  {showCreate ? t('ai.existing') : t('ai.newDeck')}
                </button>
              </div>
            </div>

            <button
              onClick={handleAdd}
              disabled={!deck && !suggestedDeck}
              style={{
                ...primaryBtn,
                opacity: !deck && !suggestedDeck ? 0.5 : 1,
                cursor: !deck && !suggestedDeck ? 'not-allowed' : 'pointer',
                width: '100%',
              }}
            >
              {t('ai.add')} ({cards.length})
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
