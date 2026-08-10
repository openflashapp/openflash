import type { Locale } from './i18n'

export type AppScreen = 'decks' | 'deck-detail' | 'study' | 'stats' | 'summary' | 'settings' | 'account' | 'themes' | 'deck-store' | 'about'

export interface AppRoute {
  screen: AppScreen
  deck: string
}

const LOCALE_PATTERN = /^\/(ru|en|de|fr|pt|zh)(?=\/|$)/

export function getPathLocale(pathname: string): Locale | null {
  return pathname.match(LOCALE_PATTERN)?.[1] as Locale | undefined ?? null
}

export function parseAppRoute(pathname: string): AppRoute {
  const rest = pathname.replace(LOCALE_PATTERN, '') || '/'
  if (rest === '/') return { screen: 'about', deck: '' }
  if (rest === '/stats') return { screen: 'stats', deck: '' }
  if (rest === '/settings') return { screen: 'settings', deck: '' }
  if (rest === '/account') return { screen: 'account', deck: '' }
  if (rest === '/themes') return { screen: 'themes', deck: '' }
  if (rest === '/deck-store') return { screen: 'deck-store', deck: '' }
  if (rest === '/about') return { screen: 'about', deck: '' }
  if (rest === '/summary') return { screen: 'summary', deck: '' }
  if (rest.startsWith('/deck/')) return { screen: 'deck-detail', deck: safeDecode(rest.slice(6)) }
  if (rest.startsWith('/study/')) return { screen: 'study', deck: safeDecode(rest.slice(7)) }
  return { screen: 'decks', deck: '' }
}

export function buildAppPath(locale: Locale, route: AppRoute): string {
  const base = `/${locale}`
  switch (route.screen) {
    case 'decks': return `${base}/app`
    case 'stats': return `${base}/stats`
    case 'settings': return `${base}/settings`
    case 'account': return `${base}/account`
    case 'themes': return `${base}/themes`
    case 'deck-store': return `${base}/deck-store`
    case 'about': return `${base}/about`
    case 'deck-detail': return `${base}/deck/${encodeURIComponent(route.deck)}`
    case 'study': return `${base}/study/${encodeURIComponent(route.deck)}`
    case 'summary': return `${base}/summary`
  }
}

export function getRouteTitle(route: AppRoute): string {
  switch (route.screen) {
    case 'decks': return 'App'
    case 'deck-detail': return route.deck || 'Deck'
    case 'study': return `Study — ${route.deck}`
    case 'stats': return 'Stats'
    case 'summary': return 'Summary'
    case 'settings': return 'Settings'
    case 'account': return 'Account'
    case 'themes': return 'Themes'
    case 'deck-store': return 'Deck Store'
    case 'about': return 'About OpenFlash'
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return ''
  }
}
