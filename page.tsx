import { redirect } from 'next/navigation'
import { getWorkspace } from '@/lib/workspace'
import { Dashboard } from '@/components/dashboard'
import './home.css'

export default async function HomePage() {
  const workspace = await getWorkspace()
  if (!workspace) redirect('/auth/login')
  return <Dashboard />
}
