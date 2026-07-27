import { useCallback, useEffect, useRef, useState } from 'react'

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  id: number
  level: LogLevel
  message: string
  time: string
}

interface Props {
  open: boolean
}

const MAX_ENTRIES = 300

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || value.message
  try {
    const serialized = JSON.stringify(value)
    return serialized === undefined ? String(value) : serialized
  } catch {
    return String(value)
  }
}

function formatArgs(args: unknown[]): string {
  return args.map(formatValue).join(' ')
}

export function DeveloperConsole({ open }: Props) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const idRef = useRef(0)

  const append = useCallback((level: LogLevel, args: unknown[]) => {
    const now = new Date()
    const time = now.toLocaleTimeString([], { hour12: false })
    const entry = { id: idRef.current++, level, message: formatArgs(args), time }
    setEntries(current => [...current, entry].slice(-MAX_ENTRIES))
  }, [])

  useEffect(() => {
    if (!open) return
    const consoleMethods: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug']
    const originals = new Map<LogLevel, (...args: unknown[]) => void>()
    consoleMethods.forEach(level => {
      const original = console[level].bind(console) as (...args: unknown[]) => void
      originals.set(level, original)
      console[level] = ((...args: unknown[]) => {
        original(...args)
        append(level, args)
      }) as typeof console[typeof level]
    })
    append('info', ['Developer console connected'])
    return () => {
      consoleMethods.forEach(level => {
        const original = originals.get(level)
        if (original) console[level] = original as typeof console[typeof level]
      })
    }
  }, [append, open])

  useEffect(() => {
    if (!collapsed && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [entries, collapsed])

  const clear = () => setEntries([])
  const copy = async () => {
    const text = entries.map(entry => `[${entry.time}] ${entry.level.toUpperCase()} ${entry.message}`).join('\n')
    if (text) await navigator.clipboard?.writeText(text)
  }

  if (!open) return null

  return (
    <>
      {expanded && <button type="button" className="developer-console-backdrop" aria-label="Close full-screen terminal" onClick={() => setExpanded(false)} />}
      <aside className={`developer-console${collapsed ? ' is-collapsed' : ''}${expanded ? ' is-expanded' : ''}`} aria-label="Developer console">
      <div className="developer-console-bar">
        <span className="developer-console-title">TERMINAL</span>
        <div className="developer-console-actions">
          <button type="button" onClick={copy} aria-label="Copy logs" title="Copy logs">COPY</button>
          <button type="button" onClick={clear} aria-label="Clear logs" title="Clear logs">CLEAR</button>
          <button type="button" onClick={() => setExpanded(value => !value)} aria-label={expanded ? 'Close full-screen terminal' : 'Open full-screen terminal'} title={expanded ? 'Close full-screen' : 'Full-screen'}>{expanded ? 'EXIT' : 'FULL'}</button>
          <button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand terminal' : 'Collapse terminal'} title={collapsed ? 'Expand' : 'Collapse'}>{collapsed ? '＋' : '−'}</button>
        </div>
      </div>
      {!collapsed && <div className="developer-console-output" ref={scrollRef}>
        {entries.length === 0 ? <span className="developer-console-empty">Waiting for application logs…</span> : entries.map(entry => (
          <div className={`developer-console-line is-${entry.level}`} key={entry.id}>
            <span className="developer-console-time">{entry.time}</span>
            <span className="developer-console-level">{entry.level}</span>
            <span className="developer-console-message">{entry.message}</span>
          </div>
        ))}
      </div>}
      </aside>
    </>
  )
}
