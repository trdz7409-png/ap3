import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getWorkspace } from '@/lib/workspace'
import { createClient } from '@/lib/supabase/server'

const clientSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(320).optional().or(z.literal('')) })

export async function POST(request: Request) {
  const workspace = await getWorkspace()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const parsed = clientSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid client name and email.' }, { status: 400 })
  const supabase = await createClient()
  const { data, error } = await supabase.from('clients').insert({ agency_id: workspace.agency.id, name: parsed.data.name, email: parsed.data.email || null }).select('id,name,email,status').single()
  if (error) return NextResponse.json({ error: 'Could not add client.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
