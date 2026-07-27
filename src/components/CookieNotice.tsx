import { useState } from 'react'
import { useLocale } from '../lib/i18n'

const COOKIE_NAME = 'openflash_cookie_notice'

function hasAcceptedCookieNotice(): boolean {
  return document.cookie.split('; ').includes(`${COOKIE_NAME}=accepted`)
}

export function CookieNotice() {
  const { t } = useLocale()
  const [visible, setVisible] = useState(() => !hasAcceptedCookieNotice())

  if (!visible) return null

  const accept = () => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE_NAME}=accepted; Max-Age=31536000; Path=/; SameSite=Lax${secure}`
    setVisible(false)
  }

  return (
    <aside className="cookie-notice" role="status">
      <p>{t('cookies.notice')}</p>
      <button type="button" onClick={accept}>{t('cookies.accept')}</button>
    </aside>
  )
}
