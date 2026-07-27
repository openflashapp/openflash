import { useEffect, useRef, useState } from 'react'
import { useFlashStore } from '../hooks/useFlashStore'
import { useLocale } from '../lib/i18n'
import { Modal } from '../components/Modal'
import { ToggleSwitch } from '../components/ToggleSwitch'
import { CheckIcon, ChevronDownIcon, CopyIcon, EyeIcon, EyeOffIcon, RefreshIcon, OpenAIIcon, AnthropicIcon, GeminiIcon, DeepSeekIcon, MistralIcon, MetaIcon, XAIIcon, OpenRouterIcon, OllamaIcon, LMStudioIcon } from '../components/Icons'
import { discoverModels, testApiKey } from '../lib/ai'
import { AI_PROVIDER_IDS, AI_PROVIDERS } from '../config/ai'
import { secondaryBtn } from '../lib/styles'
import type { AIProviderId, Backup } from '../types'
import { normalizeSettings, parseDeckConfigs, parseFlashCards, parseFolders, parseStringArray } from '../lib/validation'
import { isTheme } from '../config/themes'

interface Props {
  onBack: () => void
  toast: (msg: string, err?: boolean) => void
}

const PROVIDER_ICONS: Record<AIProviderId, typeof OpenAIIcon> = {
  openai: OpenAIIcon, anthropic: AnthropicIcon, gemini: GeminiIcon, deepseek: DeepSeekIcon,
  mistral: MistralIcon, meta: MetaIcon, xai: XAIIcon, openrouter: OpenRouterIcon,
  ollama: OllamaIcon, lmstudio: LMStudioIcon,
}

export function SettingsScreen({ onBack, toast }: Props) {
  const { t } = useLocale()
  const { settings, setSettings, cards, emptyDecks, deckConfigs, folders, theme, importBackup } = useFlashStore()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [keyTesting, setKeyTesting] = useState(false)
  const [keyTestResult, setKeyTestResult] = useState<'idle' | 'ok' | 'error'>('idle')
  const [showApiKey, setShowApiKey] = useState(false)
  const [localServerUrl, setLocalServerUrl] = useState('')
  const [discoveredModels, setDiscoveredModels] = useState<Partial<Record<AIProviderId, string[]>>>({})
  const [modelLoading, setModelLoading] = useState(false)
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [customModelMode, setCustomModelMode] = useState<Partial<Record<AIProviderId, boolean>>>({})
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const providerMenuRef = useRef<HTMLDivElement>(null)
  const providerButtonRef = useRef<HTMLButtonElement>(null)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const modelButtonRef = useRef<HTMLButtonElement>(null)
  const activeProvider = settings.activeProvider
  const providerMeta = AI_PROVIDERS[activeProvider]
  const providerCfg = settings.providers[activeProvider]
  const ProviderIcon = PROVIDER_ICONS[activeProvider]
  const requiresApiKey = providerMeta.requiresApiKey !== false
  const selectedModel = providerCfg.model || providerMeta.defaultModel
  const availableModels = discoveredModels[activeProvider] ?? []
  const matchingModels = availableModels.filter(model => model.toLowerCase().includes(modelSearch.trim().toLowerCase()))
  const customModel = customModelMode[activeProvider] === true || (providerCfg.model !== '' && !availableModels.includes(selectedModel))
  const modelButtonLabel = customModel ? providerCfg.model || 'Custom model…' : selectedModel

  useEffect(() => {
    setLocalServerUrl(providerCfg.baseUrl ?? '')
  }, [activeProvider])

  useEffect(() => {
    if (!providerMenuOpen) return
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node
      if (!providerMenuRef.current?.contains(target) && !providerButtonRef.current?.contains(target)) setProviderMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [providerMenuOpen])

  useEffect(() => {
    if (!modelMenuOpen) return
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node
      if (!modelMenuRef.current?.contains(target) && !modelButtonRef.current?.contains(target)) setModelMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [modelMenuOpen])

  const updateSettings = (next: Partial<typeof settings>) => setSettings({ ...settings, ...next })
  const updateProviderConfig = (updates: Partial<typeof providerCfg>) => {
    setSettings({ ...settings, providers: { ...settings.providers, [activeProvider]: { ...providerCfg, ...updates } } })
    setKeyTestResult('idle')
    setShowApiKey(false)
  }
  const selectProvider = (id: AIProviderId) => {
    setSettings({ ...settings, activeProvider: id })
    setKeyTestResult('idle')
    setProviderMenuOpen(false)
    setModelMenuOpen(false)
    setModelSearch('')
  }
  const selectModel = (model: string | null) => {
    const isCustom = model === null
    setCustomModelMode(current => ({ ...current, [activeProvider]: isCustom }))
    updateProviderConfig({ model: isCustom ? '' : model })
    setModelMenuOpen(false)
    setModelSearch('')
  }
  const loadModels = async (config = providerCfg, reportError = false) => {
    if (requiresApiKey && !config.apiKey) return
    setModelLoading(true)
    try {
      const models = await discoverModels(activeProvider, config)
      if (models.length > 0) {
        setDiscoveredModels(current => ({ ...current, [activeProvider]: models }))
        if (providerMeta.requiresApiKey === false && (config.model === providerMeta.defaultModel || !config.model) && !models.includes(config.model)) {
          updateProviderConfig({ model: models[0] })
        }
      }
    } catch (error) {
      if (reportError) toast((error as Error).message, true)
    } finally {
      setModelLoading(false)
    }
  }

  useEffect(() => {
    if (requiresApiKey && !providerCfg.apiKey) return
    const timer = window.setTimeout(() => { void loadModels() }, 350)
    return () => window.clearTimeout(timer)
  }, [activeProvider, providerCfg.apiKey])
  const handleExportJSON = () => {
    const safeSettings = {
      ...settings,
      providers: Object.fromEntries(Object.entries(settings.providers).map(([id, provider]) => [id, { ...provider, apiKey: '' }])) as typeof settings.providers,
    }
    const backup: Backup = { version: 1, type: 'openflash_full_backup', theme, settings: safeSettings, cards, emptyDecks, deckConfigs, folders }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'openflash_backup.json'
    link.click()
    URL.revokeObjectURL(url)
    toast(t('settings.export'))
  }
  const handleImportJSON = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast(t('errors.jsonRead'), true)
      return
    }
    const reader = new FileReader()
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target?.result as string)
        if (data?.type === 'openflash_full_backup' && data.version === 1) {
          const restoredSettings = normalizeSettings(data.settings)
          for (const id of AI_PROVIDER_IDS) restoredSettings.providers[id].apiKey = settings.providers[id].apiKey
          importBackup({
            cards: parseFlashCards(data.cards),
            emptyDecks: parseStringArray(data.emptyDecks),
            deckConfigs: parseDeckConfigs(data.deckConfigs),
            folders: parseFolders(data.folders),
            theme: isTheme(data.theme) ? data.theme : 'dark',
            settings: restoredSettings,
          })
        } else if (Array.isArray(data)) {
          importBackup({ cards: parseFlashCards(data), emptyDecks: [], deckConfigs: {}, theme: 'dark' })
        } else throw new Error('Invalid backup')
        if (jsonInputRef.current) jsonInputRef.current.value = ''
        toast(t('settings.backup'))
      } catch { toast(t('errors.jsonRead'), true) }
    }
    reader.readAsText(file)
  }
  const testConnection = async () => {
    if (requiresApiKey && !providerCfg.apiKey) { toast('Enter an API key first', true); return }
    setKeyTesting(true)
    setKeyTestResult('idle')
    try {
      await testApiKey(activeProvider, providerCfg)
      setKeyTestResult('ok')
      toast('API key is valid')
      void loadModels()
    } catch (error) {
      setKeyTestResult('error')
      toast((error as Error).message, true)
    } finally { setKeyTesting(false) }
  }
  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(providerCfg.apiKey)
      toast('API key copied')
    } catch {
      toast('Unable to copy API key', true)
    }
  }

  return (
    <div className="settings-screen">
      <header className="page-heading">
        <h1>{t('settings.title')}</h1>
        <button type="button" style={secondaryBtn} onClick={onBack}>{t('nav.back')}</button>
      </header>

      <section className="settings-section">
        <div className="settings-section-heading"><span>{t('settings.general')}</span></div>
        <div className="settings-switch-list">
          {([
            ['vimMode', t('settings.vimMode'), t('settings.vimDesc')],
            ['developerMode', t('settings.developerMode'), t('settings.developerModeDesc')],
          ] as const).map(([key, title, description]) => (
            <ToggleSwitch key={key} checked={settings[key]} label={title} description={description} onChange={checked => updateSettings({ [key]: checked })} className="settings-toggle" />
          ))}
        </div>
      </section>

      <section className="settings-section settings-ai-section">
        <div className="settings-section-heading settings-ai-heading">
          <span>{t('settings.ai')}</span>
          <div className="provider-picker">
            <button ref={providerButtonRef} type="button" className="provider-picker-button" onClick={() => { setProviderMenuOpen(open => !open); setModelMenuOpen(false) }} aria-haspopup="listbox" aria-expanded={providerMenuOpen} style={{ '--provider-color': providerMeta.color } as React.CSSProperties}>
              <ProviderIcon /><span>{providerMeta.name}</span><i className={`provider-picker-chevron${providerMenuOpen ? ' is-open' : ''}`}><ChevronDownIcon /></i>
            </button>
            {providerMenuOpen && <div ref={providerMenuRef} className="provider-menu" role="listbox" aria-label={t('settings.ai')}>
              {AI_PROVIDER_IDS.map(id => {
                const meta = AI_PROVIDERS[id]
                const Icon = PROVIDER_ICONS[id]
                const active = id === activeProvider
                return <button key={id} type="button" className={`provider-menu-option${active ? ' is-selected' : ''}`} onClick={() => selectProvider(id)} role="option" aria-selected={active} style={{ '--provider-color': meta.color } as React.CSSProperties}>
                  <Icon /><span>{meta.name}</span>{active && <i className="provider-menu-check"><CheckIcon /></i>}
                </button>
              })}
            </div>}
          </div>
        </div>

        <div className="provider-config" style={{ '--provider-color': providerMeta.color } as React.CSSProperties}>
          {requiresApiKey ? (
            <label className="settings-field"><span>API key</span><div style={{ position: 'relative' }}><input type={showApiKey ? 'text' : 'password'} autoComplete="off" value={providerCfg.apiKey} onChange={event => updateProviderConfig({ apiKey: event.target.value })} placeholder={`Enter your ${providerMeta.name} API key`} style={{ paddingRight: 70 }} /><button type="button" onClick={() => void copyApiKey()} disabled={!providerCfg.apiKey} aria-label="Copy API key" title="Copy API key" style={{ position: 'absolute', right: 34, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: providerCfg.apiKey ? 'pointer' : 'default', opacity: providerCfg.apiKey ? 1 : 0.4, padding: 4, display: 'flex' }}><CopyIcon style={{ fontSize: 16 }} /></button><button type="button" onClick={() => setShowApiKey(visible => !visible)} aria-label={showApiKey ? 'Hide API key' : 'Show API key'} title={showApiKey ? 'Hide API key' : 'Show API key'} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>{showApiKey ? <EyeOffIcon style={{ fontSize: 16 }} /> : <EyeIcon style={{ fontSize: 16 }} />}</button></div></label>
          ) : (
            <label className="settings-field"><span>Local server URL</span><input type="text" inputMode="url" autoComplete="off" value={localServerUrl} onChange={event => { const value = event.target.value; setLocalServerUrl(value); updateProviderConfig({ baseUrl: value || undefined }) }} onBlur={() => void loadModels({ ...providerCfg, baseUrl: localServerUrl || undefined }, true)} placeholder={providerMeta.baseUrl} /></label>
          )}
          <div className="settings-field"><span>Model</span>
            <div className="model-picker">
              <button ref={modelButtonRef} type="button" className="model-picker-button" onClick={() => { setModelMenuOpen(open => !open); setProviderMenuOpen(false); setModelSearch('') }} aria-haspopup="listbox" aria-expanded={modelMenuOpen}>
                <span>{modelButtonLabel}</span><i className={`provider-picker-chevron${modelMenuOpen ? ' is-open' : ''}`}><ChevronDownIcon /></i>
              </button>
              {modelMenuOpen && <div ref={modelMenuRef} className="model-menu" role="listbox" aria-label="Model">
                <input type="search" autoFocus value={modelSearch} onChange={event => setModelSearch(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder="Search models..." style={{ width: 'calc(100% - 16px)', margin: 8, height: 30, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 3, background: 'var(--bg-color)', color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: 11 }} />
                {matchingModels.map(model => <button key={model} type="button" className={`model-menu-option${!customModel && selectedModel === model ? ' is-selected' : ''}`} role="option" aria-selected={!customModel && selectedModel === model} onClick={() => selectModel(model)}>
                  <span>{model}</span>{!customModel && selectedModel === model && <i className="model-menu-check"><CheckIcon /></i>}
                </button>)}
                {availableModels.length > 0 && matchingModels.length === 0 && <div style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: 11 }}>No models found</div>}
                <button type="button" className={`model-menu-option${customModel ? ' is-selected' : ''}`} role="option" aria-selected={customModel} onClick={() => selectModel(null)}>
                  <span>Custom model…</span>{customModel && <i className="model-menu-check"><CheckIcon /></i>}
                </button>
              </div>}
            </div>
          </div>
          {customModel && <label className="settings-field"><span>Custom model ID</span><input type="text" value={providerCfg.model} onChange={event => updateProviderConfig({ model: event.target.value.trim() })} placeholder={providerMeta.defaultModel} /></label>}
          <div className="provider-actions">
            <button type="button" className="settings-primary" onClick={() => void testConnection()} disabled={keyTesting || (requiresApiKey && !providerCfg.apiKey)}>{keyTesting ? 'Testing…' : 'Test connection'}</button>
            <button type="button" className="settings-secondary" onClick={() => void loadModels(providerCfg, true)} disabled={modelLoading || (requiresApiKey && !providerCfg.apiKey)}>{modelLoading ? 'Loading models…' : <><RefreshIcon style={{ fontSize: 13, marginRight: 5 }} />Refresh models</>}</button>
            {keyTestResult === 'ok' && <span className="connection-status is-valid"><CheckIcon /> Connected</span>}
            {keyTestResult === 'error' && <span className="connection-status is-error">Connection failed</span>}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-heading"><span>{t('settings.backup')}</span></div>
        <div className="settings-backup-actions">
          <button type="button" className="settings-secondary" onClick={handleExportJSON}>{t('settings.export')}</button>
          <button type="button" className="settings-secondary" onClick={() => jsonInputRef.current?.click()}>{t('settings.import')}</button>
          <input ref={jsonInputRef} type="file" accept=".json" onChange={event => { const file = event.target.files?.[0]; if (file) handleImportJSON(file) }} />
        </div>
        <button type="button" className="settings-danger" onClick={() => setClearConfirmOpen(true)}>{t('settings.clear')}</button>
      </section>

      <Modal open={clearConfirmOpen} title={t('settings.clearConfirm')} confirmText={t('modal.delete')} cancelText={t('modal.cancel')} confirmDanger onConfirm={() => { importBackup({ cards: [], emptyDecks: [], deckConfigs: {}, theme }); setClearConfirmOpen(false); toast(t('errors.clearData')) }} onCancel={() => setClearConfirmOpen(false)}><p>{t('settings.clearDesc')}</p></Modal>
    </div>
  )
}
