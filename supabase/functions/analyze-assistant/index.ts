import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');
const assistantId = Deno.env.get('ASSISTANT_ID');

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 8 } = await req.json();

    // Check required secrets
    if (!openAIApiKey || !assistantId) {
      return new Response(
        JSON.stringify({ error: 'Missing required API keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ insights: [], criteria: [], summary: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Create a thread
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({}),
    });

    if (!threadResponse.ok) {
      const threadError = await threadResponse.json().catch(() => ({}));
      throw new Error(`Failed to create thread: ${threadError.error?.message || 'Unknown error'}`);
    }

    const thread = await threadResponse.json();
    const threadId = thread.id;

    // Step 2: Add a message to the thread
    const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        role: 'user',
        content: `נתח את המסמך הממשלתי הבא ותן ביקורת על פי רובריקת 12 הקריטריונים. החזר תוצאה בפורמט JSON עם שדות: criteria, summary, insights.

תוכן המסמך:
"""
${content}
"""

החזר רק JSON עם המבנה הבא:
{
  "criteria": [12 קריטריונים עם id, name, weight, score, justification, evidence],
  "summary": { "feasibilityPercent": מספר, "feasibilityLevel": "low/medium/high", "reasoning": הסבר },
  "insights": [תובנות עם id, criterionId, quote, explanation, suggestion, rangeStart, rangeEnd]
}

מגבל insights ל-${maxInsights} פריטים.`,
      }),
    });

    if (!messageResponse.ok) {
      const messageError = await messageResponse.json().catch(() => ({}));
      throw new Error(`Failed to create message: ${messageError.error?.message || 'Unknown error'}`);
    }

    // Step 3: Run the assistant
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      },
      body: JSON.stringify({
        assistant_id: assistantId,
      }),
    });

    if (!runResponse.ok) {
      const runError = await runResponse.json().catch(() => ({}));
      throw new Error(`Failed to create run: ${runError.error?.message || 'Unknown error'}`);
    }

    const run = await runResponse.json();
    const runId = run.id;

    // Step 4: Poll for completion
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 15; // 30 seconds timeout (15 * 2 seconds)

    while (['queued', 'in_progress'].includes(runStatus) && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      attempts++;

      try {
        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'OpenAI-Beta': 'assistants=v2',
          },
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          runStatus = statusData.status;
        } else {
          // Network error - exit early
          throw new Error('Network error during status check');
        }
      } catch (error) {
        throw new Error(`Status check failed: ${error.message}`);
      }
    }

    if (runStatus !== 'completed') {
      throw new Error(`Analysis timed out or failed with status: ${runStatus}`);
    }

    // Step 5: Get the messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    if (!messagesResponse.ok) {
      const messagesError = await messagesResponse.json().catch(() => ({}));
      throw new Error(`Failed to get messages: ${messagesError.error?.message || 'Unknown error'}`);
    }

    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');

    if (!assistantMessage || !assistantMessage.content || !assistantMessage.content[0]) {
      throw new Error('No response from assistant');
    }

    const responseText = assistantMessage.content[0].text.value;

    // Parse the response
    let parsed: any;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : responseText;
      parsed = JSON.parse(jsonText);
    } catch (_e) {
      parsed = { insights: [], criteria: [], summary: null };
    }

    // Process and validate the response (same logic as analyze-openai)
    let insights = Array.isArray(parsed.insights)
      ? parsed.insights.map((i: any, idx: number) => ({
          id: String(i?.id ?? `assistant-${idx}`),
          criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
          quote: String(i?.quote ?? ''),
          explanation: String(i?.explanation ?? ''),
          suggestion: String(i?.suggestion ?? ''),
          rangeStart: Number.isFinite(i?.rangeStart) ? i.rangeStart : 0,
          rangeEnd: Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0,
        }))
      : [];

    const criteria = Array.isArray(parsed.criteria)
      ? parsed.criteria.map((c: any) => ({
          id: (ALLOWED_CRITERIA as readonly string[]).includes(c?.id) ? c.id : 'timeline',
          name: String(c?.name ?? String(c?.id ?? '')),
          weight: Math.max(0, Math.min(100, Number(c?.weight) || 0)),
          score: Math.max(0, Math.min(5, Number(c?.score) || 0)),
          justification: String(c?.justification ?? ''),
          evidence: Array.isArray(c?.evidence) ? c.evidence.map((e: any) => ({
            quote: String(e?.quote ?? ''),
            rangeStart: Number.isFinite(e?.rangeStart) ? e.rangeStart : 0,
            rangeEnd: Number.isFinite(e?.rangeEnd) ? e.rangeEnd : 0,
          })) : [],
        }))
      : [];

    // Synthesize insights from criteria evidence if missing
    if ((!insights || insights.length === 0) && Array.isArray(criteria)) {
      const synth: any[] = [];
      for (const c of criteria) {
        if (Array.isArray(c.evidence) && c.evidence.length) {
          for (let k = 0; k < Math.min(c.evidence.length, 2); k++) {
            const e = c.evidence[k];
            synth.push({
              id: `${c.id}-ev-${k}`,
              criterionId: c.id,
              quote: String(e.quote || ''),
              explanation: c.justification || `חיזוק: ${c.name}`,
              suggestion: `שפרו את הסעיף "${c.name}" בהתאם לרובריקה.`,
              rangeStart: Number.isFinite(e.rangeStart) ? e.rangeStart : 0,
              rangeEnd: Number.isFinite(e.rangeEnd) ? e.rangeEnd : 0,
            });
          }
        }
      }
      if (synth.length) {
        insights = synth.slice(0, maxInsights);
      }
    }

    let summary = parsed?.summary && typeof parsed.summary === 'object' ? {
      feasibilityPercent: Math.max(0, Math.min(100, Number(parsed.summary.feasibilityPercent) || 0)),
      feasibilityLevel: ['low','medium','high'].includes(parsed.summary.feasibilityLevel) ? parsed.summary.feasibilityLevel : undefined,
      reasoning: String(parsed.summary.reasoning ?? ''),
    } : null;

    if (!summary || !summary.feasibilityLevel) {
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
        meta: { source: 'assistants', threadId, runId } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Analysis failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});