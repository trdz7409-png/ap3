'use client'

const colorRoles: Array<{ name: string; bg: string; fg: string }> = [
  {
    name: 'Primary',
    bg: '--md-sys-color-primary',
    fg: '--md-sys-color-on-primary',
  },
  {
    name: 'Primary container',
    bg: '--md-sys-color-primary-container',
    fg: '--md-sys-color-on-primary-container',
  },
  {
    name: 'Secondary',
    bg: '--md-sys-color-secondary',
    fg: '--md-sys-color-on-secondary',
  },
  {
    name: 'Secondary container',
    bg: '--md-sys-color-secondary-container',
    fg: '--md-sys-color-on-secondary-container',
  },
  {
    name: 'Tertiary',
    bg: '--md-sys-color-tertiary',
    fg: '--md-sys-color-on-tertiary',
  },
  {
    name: 'Tertiary container',
    bg: '--md-sys-color-tertiary-container',
    fg: '--md-sys-color-on-tertiary-container',
  },
  { name: 'Error', bg: '--md-sys-color-error', fg: '--md-sys-color-on-error' },
  {
    name: 'Error container',
    bg: '--md-sys-color-error-container',
    fg: '--md-sys-color-on-error-container',
  },
  {
    name: 'Surface',
    bg: '--md-sys-color-surface',
    fg: '--md-sys-color-on-surface',
  },
  {
    name: 'Surface variant',
    bg: '--md-sys-color-surface-variant',
    fg: '--md-sys-color-on-surface-variant',
  },
  {
    name: 'Surface container',
    bg: '--md-sys-color-surface-container',
    fg: '--md-sys-color-on-surface',
  },
  {
    name: 'Inverse surface',
    bg: '--md-sys-color-inverse-surface',
    fg: '--md-sys-color-inverse-on-surface',
  },
]

const typeScale: Array<{ cls: string; label: string }> = [
  { cls: 'md-typescale-display-large', label: 'Display Large' },
  { cls: 'md-typescale-headline-large', label: 'Headline Large' },
  { cls: 'md-typescale-title-large', label: 'Title Large' },
  { cls: 'md-typescale-body-large', label: 'Body Large' },
  { cls: 'md-typescale-label-large', label: 'Label Large' },
]

export function Foundations() {
  return (
    <section id="foundations" className="section">
      <h2 className="md-typescale-headline-medium section-title">
        Foundations
      </h2>
      <p className="md-typescale-body-large section-subtitle">
        Dynamic color roles and the Roboto type scale, expressed as design
        tokens.
      </p>

      <h3 className="md-typescale-title-medium subsection-title">
        Color roles
      </h3>
      <div className="color-grid">
        {colorRoles.map((role) => (
          <div
            key={role.name}
            className="color-swatch"
            style={{
              background: `var(${role.bg})`,
              color: `var(${role.fg})`,
            }}
          >
            <span className="md-typescale-label-large">{role.name}</span>
            <code className="md-typescale-body-small">
              {role.bg.replace('--md-sys-color-', '')}
            </code>
          </div>
        ))}
      </div>

      <h3 className="md-typescale-title-medium subsection-title">Type scale</h3>
      <div className="type-scale-card">
        {typeScale.map((t) => (
          <div key={t.cls} className="type-row">
            <span className={t.cls}>{t.label}</span>
            <code className="md-typescale-body-small type-token">{t.cls}</code>
          </div>
        ))}
      </div>
    </section>
  )
}
