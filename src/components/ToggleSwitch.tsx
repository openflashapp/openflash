interface Props {
  checked: boolean
  label: string
  description?: string
  onChange: (checked: boolean) => void
  className?: string
}

export function ToggleSwitch({ checked, label, description, onChange, className = '' }: Props) {
  return (
    <button
      type="button"
      className={`ui-toggle${className ? ` ${className}` : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-toggle-copy">
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <span className={`ui-switch${checked ? ' is-on' : ''}`} aria-hidden="true"><i /></span>
    </button>
  )
}
