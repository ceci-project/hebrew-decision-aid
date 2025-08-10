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

    // Try parsing JSON; if that fails, parse EditorAI markdown (Findings + Patch Blocks)
    let insights: any[] = [];
    let criteria: any[] = [];
    let summary: any = null;

    const mapHebrewCriterion = (t: string): AllowedId => {
      const s = (t || '').toLowerCase();
      if (s.includes('לוח') || s.includes('לו"ז') || s.includes('זמנים')) return 'timeline';
      if (s.includes('מתכל') || s.includes('צוות')) return 'integrator';
      if (s.includes('דיווח') || s.includes('בקרה')) return 'reporting';
      if (s.includes('מדידה') || s.includes('הערכ')) return 'evaluation';
      if (s.includes('ביקורת') && s.includes('חיצ')) return 'external_audit';
      if (s.includes('משאב') || s.includes('תקצ')) return 'resources';
      if (s.includes('דרג') || s.includes('מספר') || s.includes('מדיני')) return 'multi_levels';
      if (s.includes('מבנה') || s.includes('חלוקת') || s.includes('אחריות')) return 'structure';
      if (s.includes('יישום') || s.includes('שטח')) return 'field_implementation';
      if (s.includes('מכריע') || s.includes('הכרע')) return 'arbitrator';
      if (s.includes('מגזר') || s.includes('שיתוף')) return 'cross_sector';
      if (s.includes('תוצאה') || s.includes('הצלחה') || s.includes('מדד')) return 'outcomes';
      return 'timeline';
    };

    const cleanQuote = (q: string) => q.replace(/^\s*"|\"|\s*$/g, '').replace(/^"|"$/g, '').trim();

    const locateRange = (q: string) => {
      const qq = cleanQuote(q);
      if (!qq) return { rangeStart: 0, rangeEnd: 0 };
      const idx = content.indexOf(qq);
      return idx >= 0 ? { rangeStart: idx, rangeEnd: idx + qq.length } : { rangeStart: 0, rangeEnd: 0 };
    };

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

    const parsedInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    const parsedCriteria = Array.isArray(parsed.criteria) ? parsed.criteria : [];
    const parsedSummary = parsed?.summary ?? null;

    if (parsedInsights.length || parsedCriteria.length || parsedSummary) {
      // Keep JSON path behavior (legacy)
      insights = parsedInsights.map((i: any, idx: number) => ({
        id: String(i?.id ?? `ai-${idx}`),
        criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
        quote: String(i?.quote ?? ''),
        explanation: String(i?.explanation ?? ''),
        suggestion: String(i?.suggestion ?? ''),
        rangeStart: Number.isFinite(i?.rangeStart) ? i.rangeStart : 0,
        rangeEnd: Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0,
        anchor: i?.anchor ? String(i.anchor) : undefined,
        severity: ['minor','moderate','critical'].includes(i?.severity) ? i.severity : undefined,
        alternatives: Array.isArray(i?.alternatives) ? i.alternatives.map((s: any) => String(s)).filter(Boolean) : undefined,
        patchBalanced: i?.patchBalanced ? String(i.patchBalanced) : undefined,
        patchExtended: i?.patchExtended ? String(i.patchExtended) : undefined,
      }));
      criteria = parsedCriteria;
      summary = parsedSummary;
    } else {
      // Parse EditorAI markdown format
      const lines = textContent.split(/\r?\n/);
      const tableRows = lines.filter((l) => /^\s*\d+\s*\|/.test(l));
      const anchorToPatches = new Map<string, { balanced?: string; extended?: string }>();

      // Parse Patch Blocks by anchors
      const patchBlockRegex = /\[Anchor:\s*([^\]]+)\][\s\S]*?מקור:\s*"([\s\S]*?)"[\s\S]*?מוצע \(מאוזן\):\s*"([\s\S]*?)"[\s\S]*?מוצע \(מורחב\):\s*"([\s\S]*?)"/g;
      let m: RegExpExecArray | null;
      while ((m = patchBlockRegex.exec(textContent)) !== null) {
        const anchor = m[1].trim();
        anchorToPatches.set(anchor, { balanced: m[3].trim(), extended: m[4].trim() });
      }

      const parsedFindings: any[] = [];
      for (const row of tableRows) {
        const cols = row.split('|').map((c) => c.trim());
        if (cols.length < 9) continue;
        const anchor = cols[1];
        const critText = cols[2];
        const problem = cols[3];
        const quote = cols[4].replace(/^"|"$/g, '');
        const severity = cols[5].toLowerCase();
        const suggestion = cols[6];
        const alternativesRaw = cols[7];
        const alternatives = alternativesRaw
          ? alternativesRaw.split(/;|\u200f|\|/).map((s) => s.trim()).filter(Boolean)
          : [];
        const { rangeStart, rangeEnd } = locateRange(quote);
        const criterionId = mapHebrewCriterion(critText);
        const patches = anchorToPatches.get(anchor) || {};
        parsedFindings.push({
          id: `${criterionId}-${anchor}`,
          anchor,
          criterionId,
          quote,
          explanation: problem,
          suggestion,
          alternatives,
          severity: ['minor','moderate','critical'].includes(severity) ? severity : undefined,
          rangeStart,
          rangeEnd,
          patchBalanced: patches.balanced,
          patchExtended: patches.extended,
        });
      }

      insights = parsedFindings.slice(0, maxInsights);
      criteria = [];
      summary = null;
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
