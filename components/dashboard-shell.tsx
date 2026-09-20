'use client'

import dynamic from 'next/dynamic'

const Dashboard = dynamic(() => import('@/components/dashboard').then((module) => module.Dashboard), {
  ssr: false,
  loading: () => (
    <main className="loading-state">
      <p>Preparing your workspace…</p>
    </main>
  ),
})

export function DashboardShell() {
  return <Dashboard />
}
