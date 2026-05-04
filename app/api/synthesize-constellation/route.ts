import { getSupabaseServiceRole } from '@/lib/supabase-service-role'
import { redactOnairosForProfile } from '@/lib/onairos-snapshot'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are the PHENYX COLLECTIVE constellation synthesis engine. Your job is to map a user's Onairos trait data to four identity pillar scores and generate a one-paragraph synthesis for each active pillar.

The four active pillars at onboarding are:

ORIGIN: the foundational self. what was always true before it was named. maps to: consistency signals, earliest behavioral patterns, stable recurring traits.

EMERGENCE: how identity became externally visible. the first time something internal became legible to others. maps to: traits that others would recognize before the user does, social and relational signals, archetype alignment.

SELF-CREATION: the identity the user is actively building. deliberate choices, creative output, disciplines pursued. maps to: positive traits with high scores, creative and builder signals, intentional behavior patterns.

CONVERGENCE: where all threads of identity meet. the through-line across seemingly unrelated traits and interests. maps to: cross-trait patterns, the intersection of positive and improvement traits, recurring nudge themes.

Scoring rules:
- Score each pillar 0 to 100 based on how strongly the trait data supports it
- A trait_to_improve is not negative. low scores on consistency map to ORIGIN as a pattern of how this person moves through the world, not as a deficit
- Use the user_summary and top_traits_explanation as primary synthesis material
- The archetype label informs EMERGENCE most directly

For each pillar return:
- score: integer 0-100
- synthesis: one paragraph, lowercase, 2-3 sentences, written directly to the user as 'you'. no therapeutic language. no 'journey', 'authentic', 'growth'. specific to their data, not generic. make it feel like the constellation already knows them.

Return ONLY a valid JSON object in this exact shape. No preamble, no markdown, no explanation:

{
  "origin": { "score": 0-100, "synthesis": "string" },
  "emergence": { "score": 0-100, "synthesis": "string" },
  "self_creation": { "score": 0-100, "synthesis": "string" },
  "convergence": { "score": 0-100, "synthesis": "string" }
}`

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServiceRole()
    const { userId, onairosData } = await req.json()

    if (!userId || !onairosData) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }

    // Call Claude for synthesis
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ 
          role: 'user', 
          content: `Here is the user's Onairos data: ${JSON.stringify(onairosData)}` 
        }]
      })
    })

    const claude = await res.json()
    
    if (!claude.content?.[0]?.text) {
      console.error('Claude response missing content:', claude)
      return NextResponse.json({ error: 'synthesis_failed' }, { status: 500 })
    }

    let synthesis: {
      origin: { score: number; synthesis: string }
      emergence: { score: number; synthesis: string }
      self_creation: { score: number; synthesis: string }
      convergence: { score: number; synthesis: string }
    }

    try {
      synthesis = JSON.parse(claude.content[0].text.trim())
      
      // Validate shape
      const pillars = ['origin', 'emergence', 'self_creation', 'convergence'] as const
      for (const p of pillars) {
        if (typeof synthesis[p]?.score !== 'number' || typeof synthesis[p]?.synthesis !== 'string') {
          throw new Error(`invalid shape for ${p}`)
        }
      }
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError, claude.content[0].text)
      return NextResponse.json({ error: 'synthesis_failed' }, { status: 500 })
    }

    // Extract archetype from onairos data
    const archetype = onairosData?.traits?.archetype || null

    // Upsert into constellation_state
    // First check if row exists to handle version increment
    const { data: existingState } = await supabase
      .from('constellation_state')
      .select('version')
      .eq('user_id', userId)
      .single()

    const newVersion = existingState ? existingState.version + 1 : 1

    const { error: upsertError } = await supabase
      .from('constellation_state')
      .upsert({
        user_id: userId,
        generated_at: new Date().toISOString(),
        version: newVersion,
        onairos_snapshot: onairosData,
        archetype,
        origin_score: synthesis.origin.score,
        origin_synthesis: synthesis.origin.synthesis,
        emergence_score: synthesis.emergence.score,
        emergence_synthesis: synthesis.emergence.synthesis,
        self_creation_score: synthesis.self_creation.score,
        self_creation_synthesis: synthesis.self_creation.synthesis,
        convergence_score: synthesis.convergence.score,
        convergence_synthesis: synthesis.convergence.synthesis,
      }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('Failed to upsert constellation_state:', upsertError)
      // Don't fail the request - synthesis was successful
    }

    const profileSnapshot = redactOnairosForProfile(onairosData)
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update({ onairos_data: profileSnapshot })
      .eq('id', userId)

    if (profileErr) {
      console.error('Failed to update user_profiles.onairos_data:', profileErr)
    }

    return NextResponse.json({ 
      success: true, 
      synthesis,
      archetype
    })

  } catch (error) {
    console.error('synthesize-constellation error:', error)
    return NextResponse.json({ error: 'synthesis_failed' }, { status: 500 })
  }
}
