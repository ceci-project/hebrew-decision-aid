
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = "AssistantPath v2025-08-26-Optimized";
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');
const assistantId = Deno.env.get('ASSISTANT_ID');

console.log(`🚀 ${VERSION} - Starting function`);
console.log(`Environment: { hasKey: ${!!openAIApiKey}, hasProjectId: ${!!openAIProjectId}, hasAssistantId: ${!!assistantId} }`);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_CRITERIA = [
  'timeline', 'integrator', 'reporting', 'evaluation', 'external_audit', 'resources',
  'multi_levels', 'structure', 'field_implementation', 'arbitrator', 'cross_sector', 'outcomes'
] as const;

serve(async (req) => {
  console.log(`📥 ${VERSION} - Request: ${req.method} at ${new Date().toISOString()}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 24 } = await req.json();
    console.log(`📋 ${VERSION} - Processing: contentLength=${content?.length || 0}, maxInsights=${maxInsights}`);

    if (!openAIApiKey || !assistantId) {
      console.error(`❌ ${VERSION} - Missing credentials`);
      return new Response(
        JSON.stringify({ error: 'Missing required credentials', version: VERSION }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || !content.trim()) {
      console.log(`⚠️ ${VERSION} - Empty content`);
      return new Response(
        JSON.stringify({ insights: [], criteria: [], summary: null, version: VERSION }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isLongText = content.length > 4000;
    const adjustedMaxInsights = isLongText ? Math.max(maxInsights, 32) : maxInsights;
    console.log(`📝 ${VERSION} - Text analysis: isLong=${isLongText}, targetInsights=${adjustedMaxInsights}`);

    // Reduced timeout to 45 seconds
    const timeoutDuration = 45000;
    const maxPollingAttempts = 22; // 44 seconds of polling
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      };

      // Step 1: Create thread
      console.log(`🔄 ${VERSION} - Creating thread`);
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!threadResponse.ok) {
        throw new Error(`Thread creation failed: ${threadResponse.statusText}`);
      }

      const thread = await threadResponse.json();
      const threadId = thread.id;
      console.log(`✅ ${VERSION} - Thread created: ${threadId}`);

      // Simplified, more direct prompt
      const prompt = `נתח את המסמך הבא ותחזר JSON בפורמט הנדרש.

דרישות:
- בדיוק ${adjustedMaxInsights} תובנות מפורטות
- 12 קריטריונים עם ציונים 0-5
- כל הטקסט בעברית בלבד
- JSON תקין בלבד

המסמך לניתוח:
"""
${content}
"""

החזר JSON במבנה:
{
  "criteria": [12 קריטריונים],
  "summary": {"feasibilityPercent": מספר, "feasibilityLevel": "low/medium/high", "reasoning": "הסבר"},
  "insights": [${adjustedMaxInsights} תובנות מפורטות]
}`;

      // Step 2: Add message
      console.log(`🔄 ${VERSION} - Adding message`);
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: 'user',
          content: prompt,
        }),
        signal: controller.signal,
      });

      if (!messageResponse.ok) {
        throw new Error(`Message creation failed: ${messageResponse.statusText}`);
      }

      // Step 3: Run assistant
      console.log(`🔄 ${VERSION} - Running assistant`);
      const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assistant_id: assistantId,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal,
      });

      if (!runResponse.ok) {
        throw new Error(`Run creation failed: ${runResponse.statusText}`);
      }

      const run = await runResponse.json();
      const runId = run.id;
      console.log(`✅ ${VERSION} - Run started: ${runId}`);

      // Step 4: Poll for completion
      let runStatus = run.status;
      let attempts = 0;

      while (['queued', 'in_progress'].includes(runStatus) && attempts < maxPollingAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
        console.log(`🔄 ${VERSION} - Polling ${attempts}/${maxPollingAttempts} - status: ${runStatus}`);

        const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
          headers,
          signal: controller.signal,
        });

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          runStatus = statusData.status;
        } else {
          throw new Error('Status check failed');
        }
      }

      clearTimeout(timeoutId);

      if (runStatus !== 'completed') {
        console.error(`❌ ${VERSION} - Run failed: ${runStatus} after ${attempts * 2}s`);
        throw new Error(`Assistant timeout: ${runStatus}`);
      }

      console.log(`✅ ${VERSION} - Run completed in ${attempts * 2}s`);

      // Step 5: Get messages
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        headers,
        signal: controller.signal,
      });

      if (!messagesResponse.ok) {
        throw new Error('Messages retrieval failed');
      }

      const messages = await messagesResponse.json();
      const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage?.content?.[0]) {
        throw new Error('No assistant response');
      }

      const responseText = assistantMessage.content[0].text.value;
      console.log(`📄 ${VERSION} - Response length: ${responseText.length}`);

      let parsed: any;
      try {
        // Try to parse JSON directly
        let jsonText = responseText.trim();
        
        // Remove markdown code blocks if present
        const markdownMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (markdownMatch) {
          jsonText = markdownMatch[1];
        }
        
        parsed = JSON.parse(jsonText);
        console.log(`✅ ${VERSION} - JSON parsed successfully`);
      } catch (parseError) {
        console.error(`❌ ${VERSION} - JSON parse failed:`, parseError);
        console.error(`Raw response preview:`, responseText.substring(0, 500));
        throw new Error('Invalid JSON response from assistant');
      }

      // Process the results with validation
      const insights = Array.isArray(parsed.insights)
        ? parsed.insights.slice(0, adjustedMaxInsights).map((i: any, idx: number) => ({
            id: String(i?.id ?? `assistant-${idx}`),
            criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
            quote: String(i?.quote ?? '').trim().substring(0, 100),
            explanation: String(i?.explanation ?? ''),
            suggestion: String(i?.suggestion ?? ''),
            suggestion_primary: String(i?.suggestion_primary ?? i?.suggestion ?? ''),
            suggestion_secondary: String(i?.suggestion_secondary ?? ''),
            rangeStart: Number.isFinite(i?.rangeStart) ? i.rangeStart : 0,
            rangeEnd: Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0,
          }))
        : [];

      const criteria = Array.isArray(parsed.criteria)
        ? parsed.criteria.slice(0, 12).map((c: any) => ({
            id: (ALLOWED_CRITERIA as readonly string[]).includes(c?.id) ? c.id : 'timeline',
            name: String(c?.name ?? ''),
            weight: Math.max(1, Math.min(15, Number(c?.weight) || 8)),
            score: Math.max(0, Math.min(5, Number(c?.score) || 0)),
            justification: String(c?.justification ?? ''),
            evidence: Array.isArray(c?.evidence) ? c.evidence.slice(0, 2).map((e: any) => ({
              quote: String(e?.quote ?? '').trim().substring(0, 80),
              rangeStart: Number.isFinite(e?.rangeStart) ? e.rangeStart : 0,
              rangeEnd: Number.isFinite(e?.rangeEnd) ? e.rangeEnd : 0,
            })) : [],
          }))
        : [];

      const summary = parsed?.summary ? {
        feasibilityPercent: Math.max(0, Math.min(100, Number(parsed.summary.feasibilityPercent) || 50)),
        feasibilityLevel: ['low','medium','high'].includes(parsed.summary.feasibilityLevel) 
          ? parsed.summary.feasibilityLevel 
          : 'medium',
        reasoning: String(parsed.summary.reasoning ?? ''),
      } : null;

      console.log(`🎉 ${VERSION} - Success: ${insights.length} insights, ${criteria.length} criteria`);

      return new Response(
        JSON.stringify({ 
          insights, 
          criteria, 
          summary, 
          meta: { 
            source: 'assistants', 
            threadId, 
            runId, 
            version: VERSION,
            duration: `${attempts * 2}s`,
            adjustedMaxInsights
          } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (timeoutError) {
      clearTimeout(timeoutId);
      console.error(`⏰ ${VERSION} - Timeout/abort:`, timeoutError);
      throw timeoutError;
    }

  } catch (error) {
    console.error(`💥 ${VERSION} - Fatal error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || 'Assistant analysis failed', version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
