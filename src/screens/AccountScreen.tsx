import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useLocale } from '../lib/i18n'
import { login, register, checkUsernameAvailability, getStoredAuth, setStoredAuth, subscribeToAuth, changeEmail, changePassword, changeUsername, deleteAccount, verify2faLogin, get2faStatus, setup2fa, verify2fa, disable2fa, getOAuthConfig, logout, type OAuthConfig } from '../lib/api'
import { clearLearningSnapshot, clearProviderSettings, saveLearningStorageMode } from '../lib/storage'
import { clearCloudSyncState } from '../hooks/useCloudSync'
import { useFlashStore } from '../hooks/useFlashStore'
import { secondaryBtn, inputField, primaryBtn, dangerBtn } from '../lib/styles'
import { EyeIcon, EyeOffIcon, KeyIcon, RefreshIcon } from '../components/Icons'
import { generatePassword, generateUsername } from '../lib/random'
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'
import { deletePasskey, getPasskeyLoginOptions, getPasskeys, getPasskeyRegistrationOptions, verifyPasskeyLogin, verifyPasskeyRegistration, type PasskeyInfo } from '../lib/api'

const API_BASE = '/api'

const providerBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  width: '100%', height: 40, border: '1px solid var(--border)', borderRadius: 3,
  background: 'transparent', color: 'var(--text-main)', fontFamily: 'var(--font-mono)',
  fontSize: 13, cursor: 'pointer', transition: 'border-color var(--speed), opacity var(--speed)',
  padding: '0 16px',
}

const disabledBtn: React.CSSProperties = {
  ...providerBtn, opacity: 0.35, cursor: 'not-allowed',
}

interface Props {
  onBack: () => void
  toast: (msg: string, err?: boolean) => void
}

export function AccountScreen({ onBack, toast }: Props) {
  const { t } = useLocale()
  const { storageMode, setStorageMode } = useFlashStore()
  const [auth, setAuth] = useState(() => getStoredAuth())
  const [mode, setMode] = useState<'login' | 'register' | '2fa'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [totpCode, setTotpCode] = useState('')

  useEffect(() => subscribeToAuth(() => setAuth(getStoredAuth())), [])

  const [pwOpen, setPwOpen] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showOldPw, setShowOldPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwTotpCode, setPwTotpCode] = useState('')

  const [emailOpen, setEmailOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailTotpCode, setEmailTotpCode] = useState('')

  const [usernameOpen, setUsernameOpen] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)

  const [twofaEnabled, setTwofaEnabled] = useState(false)
  const [twofaSecret, setTwofaSecret] = useState('')
  const [twofaQrCode, setTwofaQrCode] = useState('')
  const [twofaVerifyCode, setTwofaVerifyCode] = useState('')
  const [twofaLoading, setTwofaLoading] = useState(false)
  const [twofaError, setTwofaError] = useState('')
  const [twofaStep, setTwofaStep] = useState<'idle' | 'setup' | 'verify'>('idle')
  const [twofaDisablePw, setTwofaDisablePw] = useState('')
  const [twofaDisableOpen, setTwofaDisableOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteTotpCode, setDeleteTotpCode] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false)
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([])
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const usernameCheckRef = useRef(0)

  useEffect(() => {
    if (mode !== 'register' || !username.trim()) {
      setUsernameStatus('idle')
      return
    }
    const checkId = ++usernameCheckRef.current
    const timer = window.setTimeout(() => {
      setUsernameStatus('checking')
      void checkUsernameAvailability(username).then(result => {
        if (checkId !== usernameCheckRef.current) return
        setUsernameStatus(result.valid ? (result.available ? 'available' : 'taken') : 'invalid')
      }).catch(() => {
        if (checkId === usernameCheckRef.current) setUsernameStatus('idle')
      })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [mode, username])

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        const result = await login(email, password)
        if ('requires2fa' in result) {
          setTempToken(result.tempToken)
          setMode('2fa')
          setLoading(false)
          return
        }
        clearCloudSyncState()
        saveLearningStorageMode('account')
        setStoredAuth(result)
        window.location.reload()
      } else {
        if (usernameStatus !== 'available') {
          setError('Choose an available username')
          setLoading(false)
          return
        }
        const result = await register(email, password, username)
        clearCloudSyncState()
        saveLearningStorageMode('account')
        setStoredAuth(result)
        window.location.reload()
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handle2faLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await verify2faLogin(tempToken, totpCode)
      clearCloudSyncState()
      saveLearningStorageMode('account')
      setStoredAuth(result)
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (!oldPassword) { setPwError('Enter current password'); return }
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return }
    if (twofaEnabled && pwTotpCode.length !== 6) { setPwError('Enter the 6-digit 2FA code'); return }
    setPwLoading(true)
    try {
      await changePassword({ oldPassword, newPassword, totpCode: pwTotpCode || undefined })
      toast('Password changed')
      setPwOpen(false)
      setOldPassword('')
      setNewPassword('')
      setPwTotpCode('')
    } catch (err) {
      setPwError((err as Error).message)
    } finally {
      setPwLoading(false)
    }
  }

  const handleChangeEmail = async (e: FormEvent) => {
    e.preventDefault()
    setEmailError('')
    if (!emailPassword) { setEmailError('Enter current password'); return }
    if (!newEmail.trim()) { setEmailError('Enter a new email address'); return }
    if (twofaEnabled && emailTotpCode.length !== 6) { setEmailError('Enter the 6-digit 2FA code'); return }
    setEmailLoading(true)
    try {
      const result = await changeEmail({ currentPassword: emailPassword, newEmail, totpCode: emailTotpCode || undefined })
      const currentAuth = getStoredAuth()
      if (currentAuth) setStoredAuth({ user: result.user })
      toast('Email address changed')
      setEmailOpen(false)
      setNewEmail('')
      setEmailPassword('')
      setEmailTotpCode('')
    } catch (err) {
      setEmailError((err as Error).message)
    } finally {
      setEmailLoading(false)
    }
  }

  const handleChangeUsername = async (e: FormEvent) => {
    e.preventDefault()
    setUsernameError('')
    if (!newUsername.trim()) { setUsernameError('Enter a username'); return }
    setUsernameLoading(true)
    try {
      const result = await changeUsername(newUsername)
      setStoredAuth({ user: result.user })
      toast('Username changed')
      setUsernameOpen(false)
      setNewUsername('')
    } catch (err) {
      setUsernameError((err as Error).message)
    } finally {
      setUsernameLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== auth?.user?.email) {
      toast('Enter your email to confirm', true)
      return
    }
    if (!deletePassword) {
      toast('Enter your password to confirm', true)
      return
    }
    if (twofaEnabled && deleteTotpCode.length !== 6) {
      toast('Enter the 6-digit 2FA code', true)
      return
    }
    setDeleting(true)
    try {
      await deleteAccount({ password: deletePassword, totpCode: deleteTotpCode || undefined })
      clearLearningSnapshot(auth.user.id)
      clearProviderSettings(auth.user.id)
      clearCloudSyncState()
      setStoredAuth(null)
      window.location.reload()
    } catch (err) {
      toast((err as Error).message, true)
      setDeleting(false)
    }
  }

  const handleSetup2fa = async () => {
    setTwofaLoading(true)
    setTwofaError('')
    try {
      const result = await setup2fa()
      setTwofaSecret(result.secret)
      setTwofaQrCode(result.qrCode)
      setTwofaStep('verify')
    } catch (err) {
      const msg = (err as Error).message
      setTwofaError(msg)
      toast(msg, true)
    } finally {
      setTwofaLoading(false)
    }
  }

  const handleVerify2fa = async () => {
    setTwofaLoading(true)
    setTwofaError('')
    try {
      await verify2fa(twofaVerifyCode)
      toast('2FA enabled')
      setTwofaEnabled(true)
      setTwofaStep('idle')
      setTwofaVerifyCode('')
      setTwofaQrCode('')
      setTwofaSecret('')
    } catch (err) {
      setTwofaError((err as Error).message)
    } finally {
      setTwofaLoading(false)
    }
  }

  const handleDisable2fa = async () => {
    setTwofaLoading(true)
    setTwofaError('')
    try {
      await disable2fa(twofaDisablePw)
      toast('2FA disabled')
      setTwofaEnabled(false)
      setTwofaDisableOpen(false)
      setTwofaDisablePw('')
    } catch (err) {
      setTwofaError((err as Error).message)
    } finally {
      setTwofaLoading(false)
    }
  }

  const [oauthConfig, setOauthConfig] = useState<OAuthConfig | null>(null)

  useEffect(() => {
    void getOAuthConfig().then(setOauthConfig).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (auth) {
      get2faStatus().then(s => setTwofaEnabled(s.enabled)).catch(() => {})
      getPasskeys().then(s => setPasskeys(s.passkeys)).catch(() => {})
    }
  }, [auth])

  const handlePasskeyLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const options = await getPasskeyLoginOptions()
      const response = await startAuthentication({ optionsJSON: options })
      const result = await verifyPasskeyLogin(response)
      clearCloudSyncState()
      saveLearningStorageMode('account')
      setStoredAuth(result)
      window.location.reload()
    } catch (err) {
      setError((err as Error).message || 'Passkey login cancelled')
    } finally { setLoading(false) }
  }

  const handlePasskeyRegistration = async () => {
    setPasskeyLoading(true)
    try {
      const options = await getPasskeyRegistrationOptions()
      const response = await startRegistration({ optionsJSON: options })
      await verifyPasskeyRegistration(response)
      setPasskeys((await getPasskeys()).passkeys)
      toast('Passkey added')
    } catch (err) { toast((err as Error).message || 'Passkey registration failed', true) }
    finally { setPasskeyLoading(false) }
  }

  const handlePasskeyDelete = async (id: string) => {
    if (passkeys.length <= 1 && !window.confirm('Delete your only passkey? You may lose passkey access to this account.')) return
    try { await deletePasskey(id); setPasskeys(passkeys.filter(passkey => passkey.id !== id)); toast('Passkey removed') }
    catch (err) { toast((err as Error).message, true) }
  }

  const handleLogout = () => {
    void (async () => {
      try {
        await logout()
      } catch (error) {
        if (getStoredAuth()) {
          toast(`Logout failed: ${(error as Error).message}`, true)
          return
        }
      }
      if (auth) {
        clearLearningSnapshot(auth.user.id)
      }
      clearCloudSyncState()
      saveLearningStorageMode('guest')
      setStoredAuth(null)
      window.location.reload()
    })()
  }

  if (!auth) {
    if (mode === '2fa') {
      return (
        <div className="account-screen account-screen-narrow">
          <header className="page-heading"><h1>Two-Factor Authentication</h1><button onClick={() => { setMode('login'); setError(''); setTotpCode('') }} style={secondaryBtn}>{t('nav.back')}</button></header>
          <section className="account-card">
            <form onSubmit={handle2faLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                Enter the 6-digit code from your authenticator app.
              </div>
              <div className="input-glow-wrapper">
                <input
                  type="text" placeholder="000000" value={totpCode} required
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ ...inputField, padding: '0 16px', height: 38, fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
                />
              </div>
              {error && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</div>}
              <button type="submit" disabled={loading || totpCode.length !== 6} style={{
                ...primaryBtn, opacity: loading ? 0.6 : 1,
              }}>
                {loading ? '...' : 'Verify'}
              </button>
            </form>
          </section>
        </div>
      )
    }

    return (
      <div className="account-screen account-screen-narrow">
        <header className="page-heading"><h1>{mode === 'login' ? 'Login' : 'Register'}</h1><button onClick={onBack} style={secondaryBtn}>{t('nav.back')}</button></header>
        <section className="account-card">
          <div className="account-unavailable-notice" role="status">
            <strong>{t('account.unavailableTitle')}</strong>
            <span>{t('account.unavailableBody')}</span>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'register' && (
              <>
                <div className="input-glow-wrapper account-username-field">
                  <input
                    type="text" placeholder="Username" value={username} required
                    onChange={e => setUsername(e.target.value)}
                    style={{ ...inputField, padding: '0 46px 0 16px', height: 38 }}
                  />
                  <button type="button" className="account-password-toggle" onClick={() => setUsername(generateUsername())} title="Generate username">
                    <RefreshIcon style={{ fontSize: 16 }} />
                  </button>
                </div>
                {usernameStatus !== 'idle' && <div className={`username-availability is-${usernameStatus}`}>{usernameStatus === 'checking' ? 'Checking username…' : usernameStatus === 'available' ? 'Username is available' : usernameStatus === 'taken' ? 'Username is already taken' : 'Use 3–30 characters, starting with a letter'}</div>}
              </>
            )}
            <div className="input-glow-wrapper">
              <input
                type="text" placeholder="Email" value={email} required
                onChange={e => setEmail(e.target.value)}
                style={{ ...inputField, padding: '0 16px', height: 38 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="input-glow-wrapper account-password-field" style={{ flex: 1 }}>
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} required
                  minLength={8}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...inputField, padding: '0 46px 0 16px', height: 38 }}
                />
                <button type="button" className="account-password-toggle" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOffIcon style={{ fontSize: 16 }} /> : <EyeIcon style={{ fontSize: 16 }} />}
                </button>
                {mode === 'register' && <button type="button" className="account-password-toggle account-password-generate" onClick={() => setPassword(generatePassword())} title="Generate password"><KeyIcon style={{ fontSize: 16 }} /></button>}
              </div>
            </div>
            {error && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{
              ...primaryBtn, opacity: loading ? 0.6 : 1,
            }}>
              {loading ? '...' : mode === 'login' ? 'Login' : 'Register'}
            </button>
            <button type="button" onClick={handlePasskeyLogin} disabled={loading} style={{ ...providerBtn, opacity: loading ? 0.6 : 1 }}>
              {loading ? '...' : 'Sign in with passkey'}
            </button>
          </form>
          <div style={{ marginTop: 16, textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>No account?{' '}<span onClick={() => { setMode('register'); setError(''); setUsername('') }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Register</span></>
            ) : (
              <>Already have an account?{' '}<span onClick={() => { setMode('login'); setError('') }} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Login</span></>
            )}
          </div>

          {oauthConfig && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>or continue with</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              <button
                onClick={() => { window.location.href = `${API_BASE}/oauth/google` }}
                style={oauthConfig.google ? providerBtn : disabledBtn}
                disabled={!oauthConfig.google}
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Google{!oauthConfig.google ? ' (not configured)' : ''}
              </button>
              <button
                onClick={() => { window.location.href = `${API_BASE}/oauth/github` }}
                style={oauthConfig.github ? { ...providerBtn, borderColor: 'var(--text-muted)' } : disabledBtn}
                disabled={!oauthConfig.github}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub{!oauthConfig.github ? ' (not configured)' : ''}
              </button>
              <button
                onClick={() => { window.location.href = `${API_BASE}/oauth/apple` }}
                style={oauthConfig.apple ? providerBtn : disabledBtn}
                disabled={!oauthConfig.apple}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                Apple{!oauthConfig.apple ? ' (not configured)' : ''}
              </button>
            </div>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="account-screen">
      <header className="page-heading"><h1>Account</h1><button onClick={onBack} style={secondaryBtn}>{t('nav.back')}</button></header>

      <section className="account-section">
        <div className="account-section-heading">Profile</div>
        <div className="account-section-body">
          <div className="account-description">
            Signed in as <strong style={{ color: 'var(--text-main)' }}>{auth.user.username || auth.user.email}</strong>
            {auth.user.username && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>({auth.user.email})</span>}
          </div>
          <button onClick={() => setLogoutConfirmOpen(true)} style={dangerBtn}>
            Logout
          </button>
          <div className="account-storage">
            <div className="account-security-setting-title">{t('storage.title')}</div>
            <div className="account-description">{t('storage.description')}</div>
            <div className="account-storage-options">
              <button type="button" className={`account-storage-option${storageMode === 'account' ? ' is-selected' : ''}`} onClick={() => setStorageMode('account')}>
                <strong>{t('storage.account')}</strong>
                <small>{t('storage.accountDesc')}</small>
              </button>
              <button type="button" className={`account-storage-option${storageMode === 'guest' ? ' is-selected' : ''}`} onClick={() => setStorageMode('guest')}>
                <strong>{t('storage.guest')}</strong>
                <small>{t('storage.guestDesc')}</small>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="account-section account-security-section">
        <div className="account-section-heading">Security</div>
        <div className="account-section-body">
          <div className="account-security-setting">
            <div className="account-security-setting-content">
              <div className="account-security-setting-title">Username</div>
              <div className="account-description">{auth.user.username || 'No username'}</div>
            </div>
            <button onClick={() => { setUsernameOpen(true); setUsernameError(''); setNewUsername(auth.user.username || '') }} style={primaryBtn}>
              Change Username
            </button>
          </div>
          <div className="account-security-setting">
            <div className="account-security-setting-content">
              <div className="account-security-setting-title">Email Address</div>
              <div className="account-description">{auth.user.email}</div>
            </div>
              <button onClick={() => { setEmailOpen(true); setEmailError(''); setNewEmail(''); setEmailPassword(''); setEmailTotpCode('') }} style={primaryBtn}>
              Change Email
            </button>
          </div>
          <div className="account-security-setting">
            <div className="account-security-setting-content">
              <div className="account-security-setting-title">Passkeys</div>
              <div className="account-description">
                Use a YubiKey, Bitwarden, phone or computer biometric. The private key never leaves your authenticator.
                {passkeys.length > 0 && <div style={{ marginTop: 8 }}>{passkeys.map(passkey => (
                  <div key={passkey.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, color: 'var(--text-main)' }}>
                    <span style={{ flex: 1 }}>{passkey.name} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>({new Date(passkey.createdAt).toLocaleDateString()})</span></span>
                    <button type="button" onClick={() => void handlePasskeyDelete(passkey.id)} style={{ ...dangerBtn, padding: '5px 8px', fontSize: 11 }}>Remove</button>
                  </div>
                ))}</div>}
              </div>
            </div>
            <button onClick={() => void handlePasskeyRegistration()} disabled={passkeyLoading} style={{ ...primaryBtn, opacity: passkeyLoading ? 0.6 : 1 }}>
              {passkeyLoading ? 'Touch authenticator…' : 'Add passkey'}
            </button>
          </div>
          <div className="account-security-setting">
            <div className="account-security-setting-content">
              <div className="account-security-setting-title">Password</div>
              <div className="account-description">Update the password used to protect your account.</div>
            </div>
              <button onClick={() => { setPwOpen(true); setPwError(''); setOldPassword(''); setNewPassword(''); setPwTotpCode('') }} style={primaryBtn}>
              Change Password
            </button>
          </div>
          <div className="account-security-setting">
            <div className="account-security-setting-content">
              <div className="account-security-setting-title">Two-Factor Authentication</div>
              <div className="account-description">
                {twofaEnabled ? '2FA is enabled' : 'Add an extra layer of security to your account.'}
              </div>
            </div>
            {twofaEnabled ? (
              <button onClick={() => { setTwofaDisableOpen(true); setTwofaDisablePw(''); setTwofaError('') }} style={dangerBtn}>
                Disable 2FA
              </button>
            ) : (
              <button onClick={handleSetup2fa} disabled={twofaLoading} style={{ ...primaryBtn, opacity: twofaLoading ? 0.6 : 1 }}>
                {twofaLoading ? '...' : 'Setup 2FA'}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="account-section account-danger-section">
        <div className="account-section-heading">Delete Account</div>
        <div className="account-section-body">
        <div className="account-description">
          This will permanently delete all your data. Type <strong style={{ color: 'var(--text-main)' }}>{auth.user.email}</strong> to confirm.
        </div>
        <div className="input-glow-wrapper" style={{ marginBottom: 12 }}>
          <input
            type="text" placeholder="Enter your email" value={deleteConfirm}
            onChange={e => setDeleteConfirm(e.target.value)}
            style={inputField}
          />
        </div>
        <div className="input-glow-wrapper" style={{ marginBottom: 12 }}>
          <input
            type="password" autoComplete="current-password" placeholder="Enter your password" value={deletePassword}
            onChange={e => setDeletePassword(e.target.value)}
            style={inputField}
          />
        </div>
        {twofaEnabled && (
          <div className="input-glow-wrapper" style={{ marginBottom: 12 }}>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="2FA code" value={deleteTotpCode}
              onChange={e => setDeleteTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...inputField, letterSpacing: 4 }}
            />
          </div>
        )}
        {deleteConfirm.trim() && (
          <div className="account-delete-warning" role="alert">
            <strong>Permanent deletion</strong>
            <span>All cards, decks and statistics will be deleted permanently. This action cannot be undone or restored.</span>
          </div>
        )}
        <button onClick={handleDeleteAccount} disabled={deleting || !deletePassword || (twofaEnabled && deleteTotpCode.length !== 6)} style={{
          ...dangerBtn, opacity: deleting ? 0.6 : 1,
        }}>
          {deleting ? '...' : 'Delete Account'}
        </button>
        </div>
      </section>

      {logoutConfirmOpen && (
        <div onClick={() => setLogoutConfirmOpen(false)} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380,
          }}>
            <h3 style={{ margin: '0 0 12px', color: 'var(--text-main)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Confirm Logout
            </h3>
            <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Are you sure you want to log out of your account?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setLogoutConfirmOpen(false)} style={secondaryBtn}>
                Cancel
              </button>
              <button type="button" onClick={handleLogout} style={dangerBtn}>
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {pwOpen && (
        <div onClick={() => { if (!pwLoading) setPwOpen(false) }} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380,
          }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-main)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Change Password
            </h3>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-glow-wrapper account-password-field">
                  <input type={showOldPw ? 'text' : 'password'} placeholder="Current password" value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)} style={{ ...inputField, padding: '0 46px 0 16px', height: 38 }} />
                <button type="button" className="account-password-toggle" onClick={() => setShowOldPw(!showOldPw)} title={showOldPw ? 'Hide password' : 'Show password'}>
                  {showOldPw ? <EyeOffIcon style={{ fontSize: 16 }} /> : <EyeIcon style={{ fontSize: 16 }} />}
                </button>
              </div>
              <div className="input-glow-wrapper account-password-field">
                  <input type={showNewPw ? 'text' : 'password'} placeholder="New password" value={newPassword}
                    minLength={8} onChange={e => setNewPassword(e.target.value)} style={{ ...inputField, padding: '0 76px 0 16px', height: 38 }} />
                <button type="button" className="account-password-toggle" onClick={() => setShowNewPw(!showNewPw)} title={showNewPw ? 'Hide password' : 'Show password'}>
                  {showNewPw ? <EyeOffIcon style={{ fontSize: 16 }} /> : <EyeIcon style={{ fontSize: 16 }} />}
                </button>
                <button type="button" className="account-password-toggle account-password-generate" onClick={() => setNewPassword(generatePassword())} title="Generate password">
                  <KeyIcon style={{ fontSize: 16 }} />
                </button>
              </div>
              {twofaEnabled && (
                <div className="input-glow-wrapper">
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="2FA code" value={pwTotpCode}
                    onChange={e => setPwTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ ...inputField, padding: '0 16px', height: 38, letterSpacing: 4 }} />
                </div>
              )}
              {pwError && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{pwError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setPwOpen(false)} disabled={pwLoading} style={secondaryBtn}>
                  Cancel
                </button>
                <button type="submit" disabled={pwLoading} style={{ ...primaryBtn, opacity: pwLoading ? 0.6 : 1 }}>
                  {pwLoading ? '...' : 'Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {emailOpen && (
        <div onClick={() => { if (!emailLoading) setEmailOpen(false) }} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380,
          }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-main)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Change Email Address
            </h3>
            <form onSubmit={handleChangeEmail} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-glow-wrapper">
                <input type="text" placeholder="New email address" value={newEmail} required
                  onChange={e => setNewEmail(e.target.value)} style={{ ...inputField, padding: '0 16px', height: 38 }} />
              </div>
              <div className="input-glow-wrapper">
                <input type="password" placeholder="Current password" value={emailPassword} required
                  onChange={e => setEmailPassword(e.target.value)} style={{ ...inputField, padding: '0 16px', height: 38 }} />
              </div>
              {twofaEnabled && (
                <div className="input-glow-wrapper">
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="2FA code" value={emailTotpCode}
                    onChange={e => setEmailTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{ ...inputField, padding: '0 16px', height: 38, letterSpacing: 4 }} />
                </div>
              )}
              {emailError && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{emailError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEmailOpen(false)} disabled={emailLoading} style={secondaryBtn}>Cancel</button>
                <button type="submit" disabled={emailLoading} style={{ ...primaryBtn, opacity: emailLoading ? 0.6 : 1 }}>
                  {emailLoading ? '...' : 'Change Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {usernameOpen && (
        <div onClick={() => { if (!usernameLoading) setUsernameOpen(false) }} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380,
          }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--text-main)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Change Username
            </h3>
            <form onSubmit={handleChangeUsername} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-glow-wrapper account-username-field">
                <input type="text" placeholder="Username" value={newUsername} required
                  onChange={e => setNewUsername(e.target.value)} style={{ ...inputField, padding: '0 46px 0 16px', height: 38 }} />
                <button type="button" className="account-password-toggle" onClick={() => setNewUsername(generateUsername())} title="Generate username">
                  <RefreshIcon style={{ fontSize: 16 }} />
                </button>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>3-30 characters, starting with a letter.</div>
              {usernameError && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{usernameError}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setUsernameOpen(false)} disabled={usernameLoading} style={secondaryBtn}>Cancel</button>
                <button type="submit" disabled={usernameLoading} style={{ ...primaryBtn, opacity: usernameLoading ? 0.6 : 1 }}>
                  {usernameLoading ? '...' : 'Change Username'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {twofaStep === 'verify' && twofaQrCode && (
        <div onClick={() => { setTwofaStep('idle'); setTwofaVerifyCode(''); setTwofaQrCode(''); setTwofaError('') }} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Setup 2FA
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code below.
            </div>
            <img src={twofaQrCode} alt="QR Code" style={{ width: 180, height: 180, imageRendering: 'pixelated' }} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all', textAlign: 'center' }}>
              Secret: <code style={{ color: 'var(--text-main)' }}>{twofaSecret}</code>
            </div>
            <div className="input-glow-wrapper" style={{ width: '100%' }}>
              <input
                type="text" placeholder="000000" value={twofaVerifyCode}
                onChange={e => setTwofaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ ...inputField, padding: '0 16px', height: 38, fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
              />
            </div>
            {twofaError && <div style={{ color: 'var(--accent-red)', fontSize: 13 }}>{twofaError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', width: '100%' }}>
              <button onClick={() => { setTwofaStep('idle'); setTwofaVerifyCode(''); setTwofaQrCode(''); setTwofaError('') }} style={secondaryBtn}>
                Cancel
              </button>
              <button onClick={handleVerify2fa} disabled={twofaLoading || twofaVerifyCode.length !== 6} style={{ ...primaryBtn, opacity: twofaLoading || twofaVerifyCode.length !== 6 ? 0.6 : 1 }}>
                {twofaLoading ? '...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {twofaDisableOpen && (
        <div onClick={() => { if (!twofaLoading) { setTwofaDisableOpen(false); setTwofaError('') } }} style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, backdropFilter: 'blur(2px)',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface-color)', border: '1px solid var(--border)',
            padding: 28, borderRadius: 3, width: 380,
          }}>
            <h3 style={{ margin: '0 0 20px', color: 'var(--accent-red)', fontSize: 14, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Disable 2FA
            </h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Enter your password to disable two-factor authentication.
            </div>
            <div className="input-glow-wrapper" style={{ marginBottom: 12 }}>
              <input
                type="password" placeholder="Password" value={twofaDisablePw}
                onChange={e => setTwofaDisablePw(e.target.value)}
                style={{ ...inputField, padding: '0 16px', height: 38 }}
              />
            </div>
            {twofaError && <div style={{ color: 'var(--accent-red)', fontSize: 13, marginBottom: 12 }}>{twofaError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setTwofaDisableOpen(false); setTwofaError('') }} disabled={twofaLoading} style={secondaryBtn}>
                Cancel
              </button>
              <button onClick={handleDisable2fa} disabled={twofaLoading || !twofaDisablePw} style={{ ...dangerBtn, opacity: twofaLoading ? 0.6 : 1 }}>
                {twofaLoading ? '...' : 'Disable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
