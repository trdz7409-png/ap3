import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getWorkspace } from '@/lib/workspace'

const schema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
})

export async function POST(request: Request) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid client name and email.' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .insert({
      agency_id: workspace.agency.id,
      name: parsed.data.name,
      email: parsed.data.email || null,
      status: 'active',
    })
    .select('id,name,email,status')
    .single()

  if (error) return NextResponse.json({ error: 'Could not add the client.' }, { status: 500 })
  return NextResponse.json({ client: data }, { status: 201 })
}

export async function GET() {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('clients')
    .select('id,name,email,status')
    .eq('agency_id', workspace.agency.id)
    .order('name')

  if (error) return NextResponse.json({ error: 'Could not load clients.' }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}
