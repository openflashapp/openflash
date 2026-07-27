import { useState, useEffect, useId, type ReactNode } from 'react'
import { useLocale } from '../lib/i18n'

interface ModalProps {
  open: boolean
  title: ReactNode
  children: ReactNode
  size?: 'compact' | 'wide'
  confirmText?: string
  cancelText?: string
  confirmDanger?: boolean
  onConfirm?: () => void | boolean
  onCancel?: () => void
}

export function Modal({ open, title, children, size = 'compact', confirmText: confirmTextProp, cancelText: cancelTextProp, confirmDanger, onConfirm, onCancel }: ModalProps) {
  const { t } = useLocale()
  const confirmText = confirmTextProp || t('modal.ok')
  const cancelText = cancelTextProp || t('modal.cancel')
  const [closing, setClosing] = useState(false)
  const [visible, setVisible] = useState(false)
  const titleId = useId()
  const wide = size === 'wide'

  useEffect(() => {
    if (open) {
      setClosing(false)
      setVisible(true)
    } else if (visible) {
      setClosing(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setClosing(false)
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open, visible])

  useEffect(() => {
    if (!visible) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancel) onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onCancel, visible])

  if (!visible) return null

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onCancel?.() }} style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 1000, backdropFilter: 'blur(2px)',
      animation: closing ? 'none' : 'fadeIn 0.12s ease-out',
      opacity: closing ? 0 : 1,
      transition: 'opacity 0.12s ease-out',
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{
        backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)',
        width: 'calc(100% - 32px)', maxWidth: wide ? 760 : 460, padding: wide ? 24 : 22, display: 'flex', flexDirection: 'column', gap: wide ? 16 : 14,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)', borderRadius: 3, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
        animation: closing ? 'none' : 'modalScale 0.15s ease-out forwards',
        transform: closing ? 'scale(0.95)' : 'scale(1)',
        opacity: closing ? 0 : 1,
        transition: 'transform 0.12s ease-out, opacity 0.12s ease-out',
      }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>
          <span id={titleId} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {title}
          </span>
        </div>
        <div>{children}</div>
        {(onConfirm || onCancel) && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            {onCancel && (
              <button onClick={() => { if (onCancel) { setClosing(true); setTimeout(() => onCancel(), 150) } }} style={modalBtnStyle}>
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button onClick={() => { const shouldClose = onConfirm(); if (shouldClose === false) return; setClosing(true) }} style={{
                ...modalBtnStyle,
                borderColor: confirmDanger ? 'var(--red)' : 'var(--accent-blue)',
                color: confirmDanger ? 'var(--red)' : 'var(--accent-blue)',
              }}>
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const modalBtnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
}
