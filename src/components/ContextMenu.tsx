import { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

interface Props {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

const menuStyle: React.CSSProperties = {
  position: 'fixed',
  background: 'var(--surface-color)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  zIndex: 1000,
  minWidth: 160,
  display: 'flex',
  flexDirection: 'column',
  padding: '6px 0',
  animation: 'fadeIn 0.1s ease-out',
}

const itemStyle: React.CSSProperties = {
  padding: '8px 16px',
  cursor: 'pointer',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  transition: 'background var(--speed), color var(--speed)',
  textAlign: 'left',
  color: 'var(--text-muted)',
  border: 'none',
  background: 'transparent',
  fontFamily: 'var(--font-mono)',
  width: '100%',
}

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '4px 0',
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const menuX = Math.min(x, window.innerWidth - 180)
  const menuY = Math.min(y, window.innerHeight - items.length * 32 - 24)

  return (
    <div ref={ref} style={{ ...menuStyle, left: menuX, top: menuY }}>
      {items.map((item, i) =>
        item.label === '-' ? (
          <div key={i} style={separatorStyle} />
        ) : (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { if (!item.disabled) { item.onClick(); onClose() } }}
            style={{
              ...itemStyle,
              color: item.danger ? 'var(--accent-red)' : 'var(--text-muted)',
              opacity: item.disabled ? 0.4 : 1,
              cursor: item.disabled ? 'default' : 'pointer',
            }}
            onMouseEnter={e => { if (!item.disabled) { e.currentTarget.style.background = 'var(--surface-hover)'; e.currentTarget.style.color = item.danger ? 'var(--accent-red)' : 'var(--text)' } }}
            onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = item.danger ? 'var(--accent-red)' : 'var(--text-muted)' }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
