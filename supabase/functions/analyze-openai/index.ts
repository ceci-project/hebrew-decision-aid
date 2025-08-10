import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ insights: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const system = `You are an assistant that reviews Hebrew public policy documents and outputs JSON only.\nReturn an object { "insights": Insight[] } where Insight = {\n  "id": string,\n  "criterionId": "legal" | "budget" | "stakeholders",\n  "quote": string,\n  "explanation": string,\n  "suggestion": string,\n  "rangeStart": number,\n  "rangeEnd": number\n}.\n- The quote must be a direct substring from the provided content.\n- rangeStart and rangeEnd are character offsets [start, end) of the first occurrence of quote in the content. If not found, set both to 0.\n- Limit to at most ${maxInsights} insights.\n- Prefer short quotes (3-8 words).`;

    const user = `Content (UTF-8 Hebrew allowed):\n"""${content}"""`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        temperature: 0.2,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('OpenAI error', data);
      return new Response(
        JSON.stringify({ error: data.error?.message || 'OpenAI error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const text = data.choices?.[0]?.message?.content || '{}';
    let json: any;
    try {
      json = JSON.parse(text);
    } catch (_e) {
      json = { insights: [] };
    }

    const insights = Array.isArray(json.insights)
      ? json.insights.map((i: any, idx: number) => ({
          id: String(i?.id ?? `ai-${idx}`),
          criterionId: ['legal', 'budget', 'stakeholders'].includes(i?.criterionId) ? i.criterionId : 'legal',
          quote: String(i?.quote ?? ''),
          explanation: String(i?.explanation ?? ''),
          suggestion: String(i?.suggestion ?? ''),
          rangeStart: Number.isFinite(i?.rangeStart) ? i.rangeStart : 0,
          rangeEnd: Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0,
        }))
      : [];

    return new Response(
      JSON.stringify({ insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('analyze-openai error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
