import { type ReactNode } from 'react'

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <div style={{ animation: 'fadeIn 0.08s ease-out' }}>
      {children}
    </div>
  )
}
