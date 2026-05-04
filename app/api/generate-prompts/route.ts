import { getSupabaseServiceRole } from '@/lib/supabase-service-role'
import { encrypt } from '@/lib/encryption'
import { detectCrisis, CRISIS_RESPONSE } from '@/lib/crisis'
import { NextRequest, NextResponse } from 'next/server'

const PILLAR_POSITIONS: Record<string, { x: number; y: number }> = {
  'ORIGIN':        { x: 0.50, y: 0.88 },
  'EMERGENCE':     { x: 0.22, y: 0.72 },
  'SELF-CREATION': { x: 0.14, y: 0.45 },
  'CONVERGENCE':   { x: 0.50, y: 0.48 },
  'BECOMING':      { x: 0.80, y: 0.52 },
  'RECOGNITION':   { x: 0.72, y: 0.25 },
  'TRANSCENDENCE': { x: 0.50, y: 0.10 },
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseServiceRole()
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { pillar, reflectionText, onairosData, experienceMode } = await req.json()

  const VALID = Object.keys(PILLAR_POSITIONS)
  if (!VALID.includes(pillar)) {
    return NextResponse.json({ error: 'invalid pillar' }, { status: 400 })
  }
  if (!reflectionText?.trim()) {
    return NextResponse.json({ error: 'reflection required' }, { status: 400 })
  }

  if (detectCrisis(reflectionText)) {
    await supabase.from('user_persona').upsert({
      user_id: user.id,
      pillar,
      reflection_text: encrypt(reflectionText),
      synthesized_insight: null,
      onairos_data: onairosData ? encrypt(JSON.stringify(onairosData)) : null,
      completed_at: new Date().toISOString()
    }, { onConflict: 'user_id,pillar' })

    return NextResponse.json({
      insight: CRISIS_RESPONSE.insight,
      resources: CRISIS_RESPONSE.resources,
      isCrisis: true
    })
  }

  const modeInstruction = 
    experienceMode === 'signal'
      ? 'the user is in signal mode. be direct and concise. lead with the core recognition immediately. one or two sentences maximum.'
      : experienceMode === 'observatory'
      ? 'the user is in observatory mode. name the sources. be specific about which signals shaped this insight. include the pattern name explicitly.'
      : 'the user is in reflection mode. use the full cinematic voice. three sentences. poetic but precise.'

  // Fetch constellation_state for additional context
  let constellationContext = ''
  const { data: constellationState } = await supabase
    .from('constellation_state')
    .select('origin_synthesis, emergence_synthesis, self_creation_synthesis, convergence_synthesis')
    .eq('user_id', user.id)
    .single()

  if (constellationState) {
    const syntheses = [
      constellationState.origin_synthesis,
      constellationState.emergence_synthesis,
      constellationState.self_creation_synthesis,
      constellationState.convergence_synthesis
    ].filter(Boolean).join(' ')
    
    if (syntheses) {
      constellationContext = `\n\nAdditional constellation context for this user: ${syntheses}`
    }
  }

  const systemPrompt = `you are the synthesis engine for PHENYX COLLECTIVE — the first identity observatory.

your task: read a written personal reflection and optional platform behavioral signals, then synthesize a single precise emotionally resonant insight that names the pattern the person could not name themselves.

this is not a summary. it is a recognition.

voice: lowercase. poetic but never vague. direct but never clinical. warm but never soft.

${modeInstruction}

strict prohibitions — never break these:
- no diagnostic language
- no disorders, conditions, or pathologies
- no content interpretable as therapeutic advice
- never use: depression, anxiety, trauma, disorder, symptoms, diagnosis, treatment, pathology
- if reflection contains distressing content: return a warm observation about the person's capacity for self-awareness. do not address the distress directly.

also return three float values between 0 and 1:
intensity: strength of this identity signal
clarity: how defined this pillar is becoming
depth: emotional depth reached in this reflection

return ONLY valid JSON. no markdown. no backticks. no preamble. exactly this shape:
{"insight":string,"intensity":number,"clarity":number,"depth":number}`

  const userMessage = `pillar: ${pillar}
onairos behavioral context: ${onairosData ? JSON.stringify(onairosData) : 'not connected — reflection only'}
reflection: ${reflectionText}${constellationContext}`

  let synthesis: {
    insight: string
    intensity: number
    clarity: number
    depth: number
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    })
    const claude = await res.json()
    synthesis = JSON.parse(claude.content[0].text.trim())
    if (typeof synthesis.insight !== 'string') throw new Error('invalid shape')
  } catch (e) {
    console.error('synthesis error:', e)
    return NextResponse.json({ error: 'synthesis failed' }, { status: 500 })
  }

  const encReflection = encrypt(reflectionText)
  const encInsight = encrypt(synthesis.insight)
  const encOnairos = onairosData ? encrypt(JSON.stringify(onairosData)) : null

  await supabase.from('user_persona').upsert({
    user_id: user.id,
    pillar,
    reflection_text: encReflection,
    synthesized_insight: encInsight,
    onairos_data: encOnairos,
    completed_at: new Date().toISOString()
  }, { onConflict: 'user_id,pillar' })

  const pos = PILLAR_POSITIONS[pillar]

  await supabase.from('constellation_points').upsert({
    user_id: user.id,
    pillar,
    x_position: pos.x,
    y_position: pos.y,
    intensity: synthesis.intensity,
    label: pillar.toLowerCase(),
    is_active: true
  }, { onConflict: 'user_id,pillar' })

  await supabase.rpc('increment_constellation_age', {
    user_id_input: user.id,
    amount: 10
  })

  return NextResponse.json({
    insight: synthesis.insight,
    intensity: synthesis.intensity,
    clarity: synthesis.clarity,
    depth: synthesis.depth,
    pillar,
    isCrisis: false
  })
}
