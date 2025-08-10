import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const assistantId = Deno.env.get('ASSISTANT_ID');
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
    if (!assistantId) {
      return new Response(
        JSON.stringify({ error: 'Missing ASSISTANT_ID' }),
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
        instructions: system,
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
    let parsed: any = { insights: [] };
    if (textContent) {
      try {
        parsed = JSON.parse(textContent);
      } catch (_) {
        const firstBrace = textContent.indexOf('{');
        const lastBrace = textContent.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          const maybeJson = textContent.slice(firstBrace, lastBrace + 1);
          try { parsed = JSON.parse(maybeJson); } catch { parsed = { insights: [] }; }
        }
      }
    }

    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.map((i: any, idx: number) => ({
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
    console.error('analyze-assistant error', error);
    return new Response(
      JSON.stringify({ error: 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
