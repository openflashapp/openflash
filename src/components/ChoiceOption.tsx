interface Props {
  checked: boolean
  label: string
  onChange: () => void
}

export function ChoiceOption({ checked, label, onChange }: Props) {
  return (
    <button type="button" className={`ui-choice${checked ? ' is-selected' : ''}`} role="radio" aria-checked={checked} onClick={onChange}>
      <span className="ui-choice-mark" aria-hidden="true"><i /></span>
      <span>{label}</span>
    </button>
  )
}
