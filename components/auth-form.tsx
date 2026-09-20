'use client'

import { FormEvent, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

type AuthFailure = {
  code?: string
  message: string
  status?: number
}

function getSignupErrorMessage(error: AuthFailure) {
  switch (error.code) {
    case 'over_email_send_rate_limit':
      return 'The confirmation email limit has been reached. Please wait before trying again, or configure custom SMTP for Supabase Auth.'
    case 'email_address_invalid':
      return 'Supabase rejected this email address. Enter a valid, deliverable email address.'
    case 'weak_password':
      return 'This password does not meet the project security requirements.'
    case 'user_already_exists':
      return 'An account with this email already exists. Sign in instead.'
    default:
      return process.env.NODE_ENV === 'development'
        ? `Supabase Auth error: ${error.message}${error.code ? ` (${error.code})` : ''}`
        : 'Account creation failed due to an unexpected authentication error. Please try again.'
  }
}

export function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const fullName = String(form.get('fullName') ?? '')
    const supabase = createSupabaseBrowserClient()
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[v0] Supabase signup failed', {
            code: error.code,
            message: error.message,
            status: error.status,
          })
        }
        setMessage(getSignupErrorMessage(error))
      } else {
        setMessage('Check your email to confirm your account.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage(error.message.includes('confirm') ? 'Please confirm your email before signing in.' : 'Invalid email or password.')
      else window.location.assign('/')
    }
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-brand" aria-label="Product introduction">
        <div className="brand-mark"><span className="material-symbols-outlined">query_stats</span></div>
        <p className="eyebrow">ADPULSE REPORTS</p>
        <h1 className="md-typescale-display-small">Client reporting without spreadsheet chaos.</h1>
        <p className="md-typescale-body-large">Connect Google Ads, turn performance into polished reports, and deliver them on schedule.</p>
      </section>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">WELCOME</p>
        <h2 id="auth-title" className="md-typescale-headline-medium">{mode === 'login' ? 'Sign in to your agency' : 'Create your workspace'}</h2>
        <form onSubmit={submit} className="auth-form">
          {mode === 'signup' && <label>Full name<input name="fullName" autoComplete="name" required /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
          {message && <p className="form-message" role="status">{message}</p>}
          <button className="filled-button" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <button className="text-button" type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
          {mode === 'login' ? 'New to AdPulse? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}
