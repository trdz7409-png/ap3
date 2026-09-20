'use client'

export function Hero() {
  return (
    <section className="hero">
      <p className="md-typescale-label-large hero-eyebrow">Material Design 3</p>
      <h1 className="md-typescale-display-large hero-title">
        Beautiful, adaptive, expressive
      </h1>
      <p className="md-typescale-body-large hero-subtitle">
        Build with Material Web — Google&apos;s official Material 3 components,
        themed end to end with design tokens for color, type, and shape.
      </p>
      <div className="hero-actions">
        <md-filled-button href="#components">
          <md-icon slot="icon">explore</md-icon>
          Explore components
        </md-filled-button>
        <md-outlined-button href="#foundations">
          View foundations
        </md-outlined-button>
      </div>
    </section>
  )
}
