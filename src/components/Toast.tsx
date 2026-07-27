import { useState, useCallback } from 'react'

interface ToastItem {
  id: number
  message: string
  error: boolean
}

let nextId = 0

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback((message: string, error = false) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, error }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const toastEl = toasts.length > 0 && (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 1100,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--surface-color)', color: 'var(--text-main)',
          border: '1px solid var(--border-color)', borderLeft: `4px solid ${t.error ? 'var(--accent-red)' : 'var(--accent-blue)'}`,
          padding: '12px 20px', fontFamily: 'var(--font-mono)', fontSize: 13,
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)', minWidth: 250,
          animation: 'fadeIn 0.1s ease-out forwards',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  )

  return { show, toastEl }
}
