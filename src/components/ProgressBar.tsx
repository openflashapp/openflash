interface Props {
  value: number
  height?: number
  borderRadius?: number
  transition?: string
  glow?: string
}

export function ProgressBar({ value, height = 4, borderRadius = 3, transition = 'width 0.5s ease', glow }: Props) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div style={{ height, background: 'var(--bg)', borderRadius, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${clamped}%`, background: 'var(--accent)',
        borderRadius, transition,
        boxShadow: glow || '0 0 8px color-mix(in srgb, var(--accent) 30%, transparent)',
      }} />
    </div>
  )
}
