import { redirect } from 'next/navigation'
import { getWorkspace } from '@/lib/workspace'
import { DashboardShell } from '@/components/dashboard-shell'
import './home.css'

export default async function HomePage() {
  const workspace = await getWorkspace()
  if (!workspace) redirect('/auth/login')
  return <DashboardShell />
}
