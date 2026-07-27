import { useState, useEffect, useCallback } from 'react'
import { FlashStoreProvider } from './hooks/useFlashStoreProvider'
import { useFlashStore } from './hooks/useFlashStore'
import { Header } from './components/Header'
import { DecksScreen } from './screens/DecksScreen'
import { DeckDetailScreen } from './screens/DeckDetailScreen'
import { StudyScreen } from './screens/StudyScreen'
import { StatsScreen } from './screens/StatsScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { ThemesScreen } from './screens/ThemesScreen'
import { DeckStoreScreen } from './screens/DeckStoreScreen'
import { AIBot } from './components/AIBot'
import { useToast } from './components/Toast'
import { PageTransition } from './components/PageTransition'
import { LocaleContext, detectLocale, getTranslations, type Locale } from './lib/i18n'
import type { SessionStats } from './types'
import type { AuthData } from './lib/api'
import { getCurrentUser, setStoredAuth } from './lib/api'
import { AccountScreen } from './screens/AccountScreen'
import { buildAppPath, getPathLocale, getRouteTitle, parseAppRoute, type AppRoute, type AppScreen } from './lib/routes'
import { applyThemePalette } from './config/themes'
import { DeveloperConsole } from './components/DeveloperConsole'
import { CookieNotice } from './components/CookieNotice'
import { saveLearningStorageMode } from './lib/storage'

function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
    const error = params.get('error')
    const oauthSuccess = params.get('oauth') === 'success'

    if (error) {
      window.location.href = '/'
      return
    }

    const finish = (auth: AuthData) => {
      saveLearningStorageMode('account')
      setStoredAuth(auth)
      window.location.replace(`/${detectLocale()}/app`)
    }

    if (oauthSuccess) {
      void getCurrentUser().then(finish).catch(() => { window.location.href = '/' })
      return
    }

    window.location.href = '/'
  }, [])

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', color: 'var(--text-muted)', fontSize: 13,
    }}>
      Signing in...
    </div>
  )
}

function AppInner() {
  const { theme, settings } = useFlashStore()
  const { show, toastEl } = useToast()

  const [locale, setLocale] = useState<Locale>(() => getPathLocale(window.location.pathname) ?? detectLocale())
  const t = useCallback((key: string) => getTranslations(locale)[key] || key, [locale])

  const [route, setRoute] = useState<AppRoute>(() => parseAppRoute(window.location.pathname))
  const { screen, deck: activeDeck } = route

  useEffect(() => {
    if (!getPathLocale(window.location.pathname)) {
      history.replaceState(null, '', buildAppPath(locale, route))
    }
  }, [locale, route])

  const handleSetLocale = useCallback((l: Locale) => {
    setLocale(l)
    history.pushState(null, '', buildAppPath(l, route))
  }, [route])

  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null)
  const [aiOpen, setAIOpen] = useState(false)

  useEffect(() => {
    const onPop = () => {
      const nextRoute = parseAppRoute(window.location.pathname)
      const nextLocale = getPathLocale(window.location.pathname)
      setRoute(nextRoute)
      if (nextLocale) setLocale(nextLocale)
      if (nextRoute.screen !== 'summary') setSessionStats(null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    applyThemePalette(theme)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (favicon && accent) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><path d="M39 3H17C9.26801 3 3 9.26801 3 17V39C3 46.732 9.26801 53 17 53H39C46.732 53 53 46.732 53 39V17C53 9.26801 46.732 3 39 3Z" fill="${accent}"/><path d="M30.8 8L15.2 30.4H25.2L22.4 48L41.6 24.3H31.5L30.8 8Z" fill="white"/></svg>`
      favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`
    }
  }, [theme])

  useEffect(() => {
    document.body.classList.toggle('developer-mode', settings.developerMode)
    return () => document.body.classList.remove('developer-mode')
  }, [settings.developerMode])

  useEffect(() => {
    document.title = getRouteTitle(route) + ' | OpenFlash'
  }, [route])

  const navigate = (nextScreen: AppScreen, deck = '') => {
    const nextRoute = { screen: nextScreen, deck } satisfies AppRoute
    setRoute(nextRoute)
    history.pushState(null, '', buildAppPath(locale, nextRoute))
    if (nextScreen !== 'summary') setSessionStats(null)
  }

  const handleOpenDeck = (name: string) => navigate('deck-detail', name)
  const handleQuickStudy = (name: string) => navigate('study', name)
  const handleStartStudy = () => navigate('study', activeDeck)

  const handleFinishStudy = (stats: SessionStats) => {
    setSessionStats(stats)
    navigate('summary')
  }

  const handleStopStudy = () => {
    show(t('study.interrupted').replace('{deck}', activeDeck))
    navigate('decks')
  }

  const handleFinishSummary = () => {
    setSessionStats(null)
    navigate('decks')
  }

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale: handleSetLocale }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Header
          onSettings={() => navigate('settings')}
          onHome={() => navigate('decks')}
          onAccount={() => navigate('account')}
          onThemes={() => navigate('themes')}
          onDeckStore={() => navigate('deck-store')}
          onStats={() => navigate('stats')}
        />
        <div className={`app-workspace${settings.developerMode ? ' has-developer-console' : ''}`}>
          <main className="app-main" style={{ padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            {screen === 'decks' && (
            <PageTransition key="decks">
              <DecksScreen onOpenDeck={handleOpenDeck} onOpenStats={() => navigate('stats')} onQuickStudy={handleQuickStudy} onOpenAI={() => setAIOpen(true)} onOpenSettings={() => navigate('settings')} toast={show} />
            </PageTransition>
          )}
          {screen === 'deck-detail' && (
            <PageTransition key="detail">
              <DeckDetailScreen deckName={activeDeck} onBack={() => navigate('decks')} onStartStudy={handleStartStudy} onRename={(_, newName) => navigate('deck-detail', newName)} toast={show} />
            </PageTransition>
          )}
          {screen === 'study' && activeDeck && (
            <PageTransition key="study">
              <StudyScreen deckName={activeDeck} onFinish={handleFinishStudy} onStop={handleStopStudy} />
            </PageTransition>
          )}
          {screen === 'stats' && (
            <PageTransition key="stats">
              <StatsScreen onBack={() => navigate('decks')} />
            </PageTransition>
          )}
          {screen === 'summary' && sessionStats && (
            <PageTransition key="summary">
              <SummaryScreen stats={sessionStats} onFinish={handleFinishSummary} />
            </PageTransition>
          )}
          {screen === 'settings' && (
            <PageTransition key="settings">
              <SettingsScreen onBack={() => navigate('decks')} toast={show} />
            </PageTransition>
          )}
          {screen === 'account' && (
            <PageTransition key="account">
              <AccountScreen onBack={() => navigate('decks')} toast={show} />
            </PageTransition>
          )}
          {screen === 'themes' && (
            <PageTransition key="themes">
              <ThemesScreen onBack={() => navigate('decks')} />
            </PageTransition>
          )}
          {screen === 'deck-store' && (
            <PageTransition key="deck-store">
              <DeckStoreScreen onBack={() => navigate('decks')} toast={show} />
            </PageTransition>
          )}
            <AIBot open={aiOpen} onClose={() => setAIOpen(false)} toast={show} />
            <CookieNotice />
            {toastEl}
          </main>
          <DeveloperConsole open={settings.developerMode} />
        </div>
      </div>
    </LocaleContext.Provider>
  )
}

export function App() {
  const [isOAuthCallback] = useState(() =>
    window.location.pathname === '/auth/callback' ||
    window.location.pathname === '/auth/callback/'
  )
  const [authReady, setAuthReady] = useState(isOAuthCallback)

  useEffect(() => {
    if (isOAuthCallback) return
    let cancelled = false

    void getCurrentUser()
      .then(auth => {
        if (!cancelled) setStoredAuth(auth)
      })
      // A network failure must not hide the account-scoped local snapshot.
      // request() clears cached identity itself when the server confirms a 401.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })

    return () => { cancelled = true }
  }, [isOAuthCallback])

  if (isOAuthCallback) return <OAuthCallback />
  if (!authReady) return null

  return (
    <FlashStoreProvider>
      <AppInner />
    </FlashStoreProvider>
  )
}
