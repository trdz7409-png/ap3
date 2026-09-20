import { createClient } from '@/lib/supabase/server'

export async function getWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: existing, error: existingError } = await supabase
    .from('agencies')
    .select('id,name,brand_color,timezone,agency_members!inner(user_id)')
    .eq('agency_members.user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing) return { user, agency: existing }

  const base = (user.user_metadata.full_name || user.email?.split('@')[0] || 'My agency').trim()
  const slug = `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${user.id.slice(0, 6)}`
  const { data, error } = await supabase.rpc('create_workspace', {
    workspace_name: `${base}'s Agency`,
    workspace_slug: slug,
  })
  if (error) throw error
  const agency = Array.isArray(data) ? data[0] : data
  if (!agency) throw new Error('Workspace creation returned no agency.')
  return { user, agency }
}
