import type { FlashCard } from '../types'

export function exportDeckCSV(name: string, cards: FlashCard[], toast?: (msg: string) => void) {
  const header = 'question,answer,transcription,transcriptionPlacement'
  const rows = cards.map(c => {
    const q = csvCell(c.question)
    const a = csvCell(c.answer)
    return [q, a, csvCell(c.transcription || ''), csvCell(c.transcriptionPlacement || 'question')].join(',')
  })
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const el = document.createElement('a')
  el.href = url
  el.download = `${name.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_')}.csv`
  el.click()
  URL.revokeObjectURL(url)
  toast?.(name)
}

function csvCell(value: string): string {
  // Spreadsheet programs can execute cells beginning with these characters.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
