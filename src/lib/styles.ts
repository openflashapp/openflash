import type { CSSProperties } from 'react'

export const primaryBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--accent-blue)', color: 'var(--accent-blue)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
}

export const secondaryBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
}

export const inputField: CSSProperties = {
  background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-main)',
  padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 15, width: '100%',
  outline: 'none', borderRadius: 3,
}

export const dangerBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--accent-red)', color: 'var(--accent-red)',
  height: 38, padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 13,
  cursor: 'pointer', borderRadius: 3, fontWeight: 500, textTransform: 'uppercase',
  display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
}

export const iconBtn: CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
  height: 28, width: 28, padding: 0, fontSize: 11, cursor: 'pointer', borderRadius: 3,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

export const checkboxBox: CSSProperties = {
  width: 16, height: 16, borderRadius: 3, border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  transition: 'background var(--speed), border-color var(--speed)',
}

export const checkboxChecked: CSSProperties = {
  background: 'var(--accent)', borderColor: 'var(--accent)',
}

export const checkIconWhite = { fontSize: 11, color: '#fff' }
