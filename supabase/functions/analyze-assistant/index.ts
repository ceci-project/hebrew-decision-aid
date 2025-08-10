import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const assistantId = Deno.env.get('ASSISTANT_ID');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_CRITERIA = [
  'timeline',
  'integrator',
  'reporting',
  'evaluation',
  'external_audit',
  'resources',
  'multi_levels',
  'structure',
  'field_implementation',
  'arbitrator',
  'cross_sector',
  'outcomes',
] as const;

type AllowedId = typeof ALLOWED_CRITERIA[number];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 8 } = await req.json();

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!assistantId) {
      return new Response(
        JSON.stringify({ error: 'Missing ASSISTANT_ID' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ insights: [], criteria: [], summary: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const system = `You are an assistant that evaluates Hebrew government decisions using a fixed 12-criteria rubric. Output JSON ONLY.
Return an object with this exact structure:
{
  "criteria": Array<{
    "id": "timeline" | "integrator" | "reporting" | "evaluation" | "external_audit" | "resources" | "multi_levels" | "structure" | "field_implementation" | "arbitrator" | "cross_sector" | "outcomes",
    "name": string,
    "weight": number,            // percentage 0-100 matching the rubric weights
    "score": number,             // integer 0-5
    "justification": string,     // concise rationale in Hebrew
    "evidence"?: Array<{ "quote": string, "rangeStart": number, "rangeEnd": number }>
  }>,
  "summary": {
    "feasibilityPercent": number,           // 0-100 weighted by the 12 criteria
    "feasibilityLevel": "low" | "medium" | "high", // 0-49 low, 50-74 medium, 75-100 high
    "reasoning": string
  },
  "insights": Array<{
    "id": string,
    "criterionId": "timeline" | "integrator" | "reporting" | "evaluation" | "external_audit" | "resources" | "multi_levels" | "structure" | "field_implementation" | "arbitrator" | "cross_sector" | "outcomes",
    "quote": string,
    "explanation": string,
    "suggestion": string,
    "rangeStart": number,
    "rangeEnd": number
  }>
}
Rules:
- Quotes MUST be direct substrings of the content.
- rangeStart/rangeEnd are [start,end) offsets for the first occurrence of the quote; if not found, set both to 0.
- Prefer short quotes (3–8 words).
- Hebrew output where relevant; JSON only, no markdown fences.
- Keep insights to at most ${maxInsights}.`;

    const user = `Content (UTF-8 Hebrew allowed):\n"""${content}"""`;

    // Create a thread and run with the Assistant
    const runCreateResp = await fetch('https://api.openai.com/v1/threads/runs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
        additional_instructions: system,
        thread: {
          messages: [
            { role: 'user', content: user }
          ]
        },
      }),
    });

    const runCreateData = await runCreateResp.json();
    if (!runCreateResp.ok) {
      console.error('Assistant run create error', runCreateData);
      return new Response(
        JSON.stringify({ error: runCreateData.error?.message || 'Assistant run create error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const threadId = runCreateData?.thread_id;
    const runId = runCreateData?.id;

    // Poll the run until completion or failure
    let status = runCreateData?.status;
    const startedAt = Date.now();
    let lastRunData = runCreateData;
    while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
      if (Date.now() - startedAt > 45000) { // 45s timeout
        return new Response(
          JSON.stringify({ error: 'Assistant run timed out' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
      const runCheckResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
          'OpenAI-Beta': 'assistants=v2',
        }
      });
      const runCheckData = await runCheckResp.json();
      status = runCheckData?.status;
      lastRunData = runCheckData;
    }

    if (status !== 'completed') {
      return new Response(
        JSON.stringify({ error: `Assistant run ended with status: ${status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the latest messages
    const msgsResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages?order=desc&limit=10`, {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
        'OpenAI-Beta': 'assistants=v2',
      }
    });
    const msgsData = await msgsResp.json();
    if (!msgsResp.ok) {
      console.error('Assistant messages error', msgsData);
      return new Response(
        JSON.stringify({ error: msgsData.error?.message || 'Assistant messages error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firstAssistant = (msgsData?.data || []).find((m: any) => m.role === 'assistant');
    let textContent = '';
    try {
      const parts = (firstAssistant?.content || []).filter((c: any) => c.type === 'text').map((c: any) => c.text?.value || '');
      textContent = parts.join('\n').trim();
    } catch (_) {
      textContent = '';
    }

    // Extract JSON from the text
    let parsed: any = { insights: [], criteria: [], summary: null };
    if (textContent) {
      try {
        parsed = JSON.parse(textContent);
      } catch (_) {
        const firstBrace = textContent.indexOf('{');
        const lastBrace = textContent.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const maybeJson = textContent.slice(firstBrace, lastBrace + 1);
          try { parsed = JSON.parse(maybeJson); } catch { parsed = { insights: [], criteria: [], summary: null }; }
        }
      }
    }

    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.map((i: any, idx: number) => {
          const criterionId = (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline';
          const quote = String(i?.quote ?? '');
          let rangeStart = Number.isFinite(i?.rangeStart) ? i.rangeStart : 0;
          let rangeEnd = Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0;
          return {
            id: String(i?.id ?? `ai-${idx}`),
            criterionId,
            quote,
            explanation: String(i?.explanation ?? ''),
            suggestion: String(i?.suggestion ?? ''),
            rangeStart,
            rangeEnd,
          };
        })
      : [];

    const criteria = Array.isArray(parsed.criteria)
      ? parsed.criteria.map((c: any, idx: number) => {
          const id: AllowedId = (ALLOWED_CRITERIA as readonly string[]).includes(c?.id) ? c.id : 'timeline';
          const weightRaw = Number.isFinite(c?.weight) ? c.weight : 0;
          const weight = Math.max(0, Math.min(100, weightRaw));
          const scoreRaw = Number.isFinite(c?.score) ? c.score : 0;
          const score = Math.max(0, Math.min(5, scoreRaw));
          const evidence = Array.isArray(c?.evidence)
            ? c.evidence.map((e: any) => ({
                quote: String(e?.quote ?? ''),
                rangeStart: Number.isFinite(e?.rangeStart) ? e.rangeStart : 0,
                rangeEnd: Number.isFinite(e?.rangeEnd) ? e.rangeEnd : 0,
              }))
            : [];
          return {
            id,
            name: String(c?.name ?? id),
            weight,
            score,
            justification: String(c?.justification ?? ''),
            evidence,
          };
        })
      : [];

    let summary = parsed?.summary && typeof parsed.summary === 'object' ? {
      feasibilityPercent: Math.max(0, Math.min(100, Number(parsed.summary.feasibilityPercent) || 0)),
      feasibilityLevel: ['low','medium','high'].includes(parsed.summary.feasibilityLevel) ? parsed.summary.feasibilityLevel : undefined,
      reasoning: String(parsed.summary.reasoning ?? ''),
    } : null;

    if (!summary || !summary.feasibilityLevel) {
      // Derive from criteria if missing
      const totalW = criteria.reduce((s: number, c: any) => s + (c.weight || 0), 0) || 1;
      const pct = criteria.reduce((s: number, c: any) => s + ((c.score || 0) / 5) * (c.weight || 0), 0) / totalW * 100;
      const percent = Math.round(pct);
      const level = percent < 50 ? 'low' : percent < 75 ? 'medium' : 'high';
      summary = { feasibilityPercent: percent, feasibilityLevel: level, reasoning: summary?.reasoning || '' } as any;
    }

    return new Response(
      JSON.stringify({
        insights,
        criteria,
        summary,
        meta: {
          source: 'assistants',
          assistantId,
          runId,
          model: lastRunData?.model ?? runCreateData?.model ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('analyze-assistant error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
