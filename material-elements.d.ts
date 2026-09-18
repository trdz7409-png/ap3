import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type MaterialProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & Record<string, unknown>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-circular-progress': MaterialProps
      'md-icon': MaterialProps
      'md-filled-button': MaterialProps
      'md-outlined-button': MaterialProps
      'md-text-button': MaterialProps
      'md-icon-button': MaterialProps
      'md-filled-text-field': MaterialProps
      'md-outlined-text-field': MaterialProps
      'md-checkbox': MaterialProps
      'md-radio': MaterialProps
      'md-switch': MaterialProps
      'md-divider': MaterialProps
      'md-slider': MaterialProps
      'md-chip-set': MaterialProps
      'md-filter-chip': MaterialProps
      'md-tabs': MaterialProps
      'md-primary-tab': MaterialProps
      'md-linear-progress': MaterialProps
      'md-fab': MaterialProps
    }
  }
}
