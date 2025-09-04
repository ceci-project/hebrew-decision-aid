
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = "AssistantPath v2025-08-26-D-Hebrew-Enhanced";
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('VITE_OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID') || Deno.env.get('VITE_OPENAI_PROJECT_ID') || Deno.env.get('DECISION_AID_OPENAI_PROJECT_ID');
const assistantId = Deno.env.get('ASSISTANT_ID') || Deno.env.get('VITE_ASSISTANT_ID') || Deno.env.get('DECISION_AID_ASSISTANT_ID');

console.log(`🚀 ${VERSION} - Starting enhanced analyze-assistant function`);
console.log(`Environment check: { hasOpenaiKey: ${!!openAIApiKey}, openaiKeyLength: ${openAIApiKey?.length || 0}, hasProjectId: ${!!openAIProjectId}, hasAssistantId: ${!!assistantId}, assistantIdLength: ${assistantId?.length || 0} }`);

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

// Fallback Chat Completions function for when Assistant API fails
async function fallbackToChatAPI(content: string, maxInsights: number) {
  console.log(`🔄 ${VERSION} - Falling back to Chat Completions API`);
  
  const systemPrompt = `אתה עוזר שמעריך החלטות ממשלתיות בעברית בלבד באמצעות רובריקה של 12 קריטריונים. תחזיר JSON בלבד.

חשוב מאוד - מערכת הניקוד לכל קריטריון (חובה 0-5):
- ציון 0 = אין התייחסות כלל לקריטריון בטקסט ההחלטה
- ציון 1 = התייחסות מינימלית או רמיזה בלבד לקריטריון
- ציון 2 = התייחסות חלקית עם חוסרים משמעותיים
- ציון 3 = התייחסות בינונית עם כמה פרטים חסרים
- ציון 4 = התייחסות טובה עם רוב הפרטים הנדרשים
- ציון 5 = התייחסות מצוינת ומקיפה עם כל הפרטים הנדרשים

חובה: תן ציון 0 לכל קריטריון שלא מוזכר או לא רלוונטי בטקסט!

חזור אובייקט עם השדות: criteria[12], summary, insights[]. ראה את הסוגים המדויקים למטה.

חובה: כל הטקסט בשדות explanation, suggestion, suggestion_primary, suggestion_secondary, justification, reasoning, name חייב להיות בעברית בלבד!

{
  "criteria": Array<{
    "id": "timeline" | "integrator" | "reporting" | "evaluation" | "external_audit" | "resources" | "multi_levels" | "structure" | "field_implementation" | "arbitrator" | "cross_sector" | "outcomes",
    "name": string,              // בעברית בלבד
    "weight": number,            // percentage 0-100 matching the rubric weights
    "score": number,             // integer 0-5
    "justification": string,     // בעברית בלבד
    "evidence"?: Array<{ "quote": string, "rangeStart": number, "rangeEnd": number }>
  }>,
  "summary": {
    "feasibilityPercent": number,           // 0-100 weighted by the 12 criteria
    "feasibilityLevel": "low" | "medium" | "high", // 0-49 low, 50-74 medium, 75-100 high
    "reasoning": string                     // בעברית בלבד
  },
  "insights": Array<{
    "id": string,
    "criterionId": "timeline" | "integrator" | "reporting" | "evaluation" | "external_audit" | "resources" | "multi_levels" | "structure" | "field_implementation" | "arbitrator" | "cross_sector" | "outcomes",
    "quote": string,
    "explanation": string,           // בעברית בלבד
    "suggestion": string,           // בעברית בלבד
    "suggestion_primary": string,   // בעברית בלבד
    "suggestion_secondary": string, // בעברית בלבד
    "rangeStart": number,
    "rangeEnd": number
  }>
}

מגביל insights ל-${maxInsights} פריטים מקסימום.

חיוני: כל הטקסט חייב להיות בעברית בלבד!`;

  const userPrompt = `נתח את המסמך הממשלתי הבא ותן ביקורת על פי רובריקת 12 הקריטריונים:

${content.substring(0, 8000)}

החזר רק JSON עם המבנה שצוין לעיל.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
      ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chat API failed: ${response.status}`);
  }

  const data = await response.json();
  const responseText = data.choices?.[0]?.message?.content;
  
  if (!responseText) {
    throw new Error('Empty response from Chat API');
  }

  return JSON.parse(responseText);
}

// Process and validate analysis results (used by both Assistant and Chat APIs)
function processAnalysisResult(parsed: any, maxInsights: number) {
  let insights = Array.isArray(parsed.insights)
    ? parsed.insights.slice(0, maxInsights).map((i: any, idx: number) => ({
        id: String(i?.id ?? `assistant-${idx}`),
        criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
        quote: String(i?.quote ?? ''),
        explanation: String(i?.explanation ?? ''),
        suggestion: String(i?.suggestion ?? ''),
        suggestion_primary: String(i?.suggestion_primary ?? i?.suggestion ?? ''),
        suggestion_secondary: String(i?.suggestion_secondary ?? ''),
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
          const defaultSuggestions = getDefaultSuggestions(c.id);
          synth.push({
            id: `${c.id}-ev-${k}`,
            criterionId: c.id,
            quote: String(e.quote || ''),
            explanation: c.justification || `חיזוק: ${c.name}`,
            suggestion: defaultSuggestions.primary,
            suggestion_primary: defaultSuggestions.primary,
            suggestion_secondary: defaultSuggestions.secondary,
            rangeStart: Number.isFinite(e.rangeStart) ? e.rangeStart : 0,
            rangeEnd: Number.isFinite(e.rangeEnd) ? e.rangeEnd : 0,
          });
        }
      }
    }
    if (synth.length > 0) {
      insights = synth.slice(0, maxInsights);
    }
  }

  const summary = parsed.summary ? {
    feasibilityPercent: Math.max(0, Math.min(100, Number(parsed.summary.feasibilityPercent) || 0)),
    feasibilityLevel: ['low', 'medium', 'high'].includes(parsed.summary.feasibilityLevel) 
      ? parsed.summary.feasibilityLevel : 'medium',
    reasoning: String(parsed.summary.reasoning || 'לא צוין נימוק')
  } : null;

  return { insights, criteria, summary };
}

serve(async (req) => {
  console.log(`📥 ${VERSION} - Request received: ${req.method} at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ ${VERSION} - Handling CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 6 } = await req.json();
    console.log(`📋 ${VERSION} - Request parsed: contentLength=${content?.length || 0}, maxInsights=${maxInsights}`);

    // Check required secrets
    if (!openAIApiKey || !assistantId) {
      console.error(`❌ ${VERSION} - Missing required API keys: hasOpenaiKey=${!!openAIApiKey}, hasAssistantId=${!!assistantId}`);
      return new Response(
        JSON.stringify({ error: 'Missing required API keys', version: VERSION }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      console.log(`⚠️ ${VERSION} - Empty content provided`);
      return new Response(
        JSON.stringify({ insights: [], criteria: [], summary: null, version: VERSION }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pre-filter long inputs
    const truncatedContent = content.length > 8000 ? content.substring(0, 8000) + "..." : content;
    console.log(`📝 ${VERSION} - Content prepared: originalLength=${content.length}, truncatedLength=${truncatedContent.length}`);

    // Create AbortController for more aggressive timeout for Assistant API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for Assistant API

    try {
      console.log(`🔄 ${VERSION} - Step 1: Creating thread`);
      
      // Prepare headers - don't include OpenAI-Organization header to avoid the mismatch error
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      };
      
      // Don't add OpenAI-Organization header to avoid the mismatch error
      console.log(`🔧 ${VERSION} - Using headers without OpenAI-Organization to avoid mismatch error`);

      // Step 1: Create a thread
      const threadResponse = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (!threadResponse.ok) {
        const threadError = await threadResponse.json().catch(() => ({}));
        console.error(`❌ ${VERSION} - Thread creation failed:`, threadError);
        throw new Error(`Failed to create thread: ${threadError.error?.message || 'Unknown error'}`);
      }

      const thread = await threadResponse.json();
      const threadId = thread.id;
      console.log(`✅ ${VERSION} - Thread created: ${threadId}`);

      // Step 2: Add a message to the thread
      console.log(`🔄 ${VERSION} - Step 2: Adding message to thread`);
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: 'user',
          content: `נתח את המסמך הממשלתי הבא ותן ביקורת על פי רובריקת 12 הקריטריונים.

חשוב מאוד - מערכת הניקוד לכל קריטריון (חובה 0-5):
- ציון 0 = אין התייחסות כלל לקריטריון בטקסט ההחלטה
- ציון 1 = התייחסות מינימלית או רמיזה בלבד לקריטריון
- ציון 2 = התייחסות חלקית עם חוסרים משמעותיים
- ציון 3 = התייחסות בינונית עם כמה פרטים חסרים
- ציון 4 = התייחסות טובה עם רוב הפרטים הנדרשים
- ציון 5 = התייחסות מצוינת ומקיפה עם כל הפרטים הנדרשים

חובה: תן ציון 0 לכל קריטריון שלא מוזכר או לא רלוונטי בטקסט!

חשוב מאוד: כל התוכן חייב להיות בעברית בלבד!

עבור כל insight, כלול:
- explanation: הסבר כללי בעברית מה הבעיה או החוזקה
- suggestion: הצעה ראשונית קצרה לשיפור בעברית
- suggestion_primary: הצעה מפורטת ראשונית בעברית (50-100 מילים)
- suggestion_secondary: הצעה חלופית או משלימה בעברית (50-100 מילים)

כל השדות הטקסטואליים חייבים להיות בעברית בלבד: explanation, suggestion, suggestion_primary, suggestion_secondary, justification, reasoning, name.

תוכן המסמך:
"""
${truncatedContent}
"""

החזר רק JSON עם המבנה הבא:
{
  "criteria": [12 קריטריונים עם id, name (בעברית), weight, score, justification (בעברית), evidence],
  "summary": { "feasibilityPercent": מספר, "feasibilityLevel": "low/medium/high", "reasoning": "הסבר בעברית" },
  "insights": [תובנות עם id, criterionId, quote, explanation (בעברית), suggestion (בעברית), suggestion_primary (בעברית), suggestion_secondary (בעברית), rangeStart, rangeEnd]
}

מגבל insights ל-${maxInsights} פריטים.

זכור: כל הטקסט חייב להיות בעברית בלבד!`,
        }),
        signal: controller.signal,
      });

      if (!messageResponse.ok) {
        const messageError = await messageResponse.json().catch(() => ({}));
        console.error(`❌ ${VERSION} - Message creation failed:`, messageError);
        throw new Error(`Failed to create message: ${messageError.error?.message || 'Unknown error'}`);
      }

      console.log(`✅ ${VERSION} - Message added to thread`);

      // Step 3: Run the assistant
      console.log(`🔄 ${VERSION} - Step 3: Running assistant ${assistantId}`);
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
        const runError = await runResponse.json().catch(() => ({}));
        console.error(`❌ ${VERSION} - Run creation failed:`, runError);
        throw new Error(`Failed to create run: ${runError.error?.message || 'Unknown error'}`);
      }

      const run = await runResponse.json();
      const runId = run.id;
      console.log(`✅ ${VERSION} - Run created: ${runId}, status: ${run.status}`);

      // Step 4: Poll for completion - reduced timeout for faster fallback
      console.log(`🔄 ${VERSION} - Step 4: Polling for completion`);
      let runStatus = run.status;
      let attempts = 0;
      const maxAttempts = 6; // 12 seconds timeout (6 * 2 seconds)

      while (['queued', 'in_progress'].includes(runStatus) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
        console.log(`🔄 ${VERSION} - Polling attempt ${attempts}/${maxAttempts}, current status: ${runStatus}`);

        try {
          const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
            headers,
            signal: controller.signal,
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            runStatus = statusData.status;
            console.log(`📊 ${VERSION} - Status update: ${runStatus}`);
          } else {
            console.error(`❌ ${VERSION} - Status check failed: ${statusResponse.status}`);
            throw new Error('Network error during status check');
          }
        } catch (error) {
          console.error(`❌ ${VERSION} - Status check exception:`, error);
          throw new Error(`Status check failed: ${error.message}`);
        }
      }

      clearTimeout(timeoutId);

      if (runStatus !== 'completed') {
        console.error(`❌ ${VERSION} - Run failed with final status: ${runStatus} after ${attempts} attempts`);
        throw new Error(`Analysis timed out or failed with status: ${runStatus}`);
      }

      console.log(`✅ ${VERSION} - Run completed successfully`);

      // Step 5: Get the messages
      console.log(`🔄 ${VERSION} - Step 5: Retrieving messages`);
      const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        headers,
        signal: controller.signal,
      });

      if (!messagesResponse.ok) {
        const messagesError = await messagesResponse.json().catch(() => ({}));
        console.error(`❌ ${VERSION} - Messages retrieval failed:`, messagesError);
        throw new Error(`Failed to get messages: ${messagesError.error?.message || 'Unknown error'}`);
      }

      const messages = await messagesResponse.json();
      const assistantMessage = messages.data.find((msg: any) => msg.role === 'assistant');

      if (!assistantMessage || !assistantMessage.content || !assistantMessage.content[0]) {
        console.error(`❌ ${VERSION} - No valid assistant response found`);
        throw new Error('No response from assistant');
      }

      const responseText = assistantMessage.content[0].text.value;
      console.log(`📄 ${VERSION} - Response received, length: ${responseText.length}`);

      // Parse the response with fallback
      let parsed: any;
      try {
        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? jsonMatch[0] : responseText;
        parsed = JSON.parse(jsonText);
        console.log(`✅ ${VERSION} - JSON parsed successfully`);
      } catch (parseError) {
        console.error(`❌ ${VERSION} - JSON parse failed:`, parseError);
        // Fallback to empty structure
        parsed = { insights: [], criteria: [], summary: null };
      }

      // Process and validate the response using shared function
      const processedResult = processAnalysisResult(parsed, maxInsights);
      
      // For Assistant API, add debugging info
      console.log(`🎉 ${VERSION} - Analysis completed successfully: ${processedResult.insights.length} insights, ${processedResult.criteria.length} criteria`);
      console.log(`📊 ${VERSION} - Sample insight check:`, processedResult.insights[0] ? {
        id: processedResult.insights[0].id,
        hasSuggestion: !!processedResult.insights[0].suggestion,
        hasPrimary: !!processedResult.insights[0].suggestion_primary,
        hasSecondary: !!processedResult.insights[0].suggestion_secondary,
        isHebrew: /[\u0590-\u05FF]/.test(processedResult.insights[0].explanation || '')
      } : 'No insights');

      return new Response(
        JSON.stringify({ 
          ...processedResult,
          meta: { source: 'assistants', threadId, runId, version: VERSION } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (timeoutError) {
      clearTimeout(timeoutId);
      console.error(`⏰ ${VERSION} - Assistant API timeout or abort, attempting fallback:`, timeoutError);
      throw timeoutError;
    }

  } catch (error) {
    console.error(`💥 ${VERSION} - Assistant API failed, attempting Chat API fallback:`, error);
    
    // Fallback to Chat Completions API
    try {
      console.log(`🔄 ${VERSION} - Attempting Chat API fallback`);
      const fallbackResult = await fallbackToChatAPI(content, maxInsights);
      
      // Process the fallback result with the same validation logic
      const processedResult = processAnalysisResult(fallbackResult, maxInsights);
      
      return new Response(
        JSON.stringify({
          ...processedResult,
          meta: { source: 'openai', model: 'gpt-4o', version: VERSION, fallback: true }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fallbackError) {
      console.error(`💥 ${VERSION} - Both Assistant API and Chat API failed:`, fallbackError);
      return new Response(
        JSON.stringify({ 
          error: 'Both analysis methods failed', 
          details: {
            assistantError: error.message,
            fallbackError: fallbackError.message
          },
          version: VERSION 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

});

// Helper function to provide default suggestions for each criterion in Hebrew
function getDefaultSuggestions(criterionId: string): { primary: string; secondary: string } {
  const suggestions: Record<string, { primary: string; secondary: string }> = {
    timeline: {
      primary: "הוסיפו לוחות זמנים מחייבים עם תאריכי יעד ברורים וסנקציות באי-עמידה בהם.",
      secondary: "צרו מערכת מעקב ודיווח שבועית על התקדמות מול הלוח זמנים המתוכנן."
    },
    integrator: {
      primary: "הגדירו צוות מתכלל עם הרכב מוגדר, סמכויות ברורות ותדירות ישיבות קבועה.",
      secondary: "קבעו נהלים ברורים לתיאום בין-משרדי וגורמים שונים עם אחריות מוגדרת."
    },
    reporting: {
      primary: "קבעו מנגנון דיווח סדיר: תדירות, פורמט סטנדרטי וטיפול בחריגות.",
      secondary: "הקימו מערכת מחוונים למעקב אחר התקדמות והישגים."
    },
    evaluation: {
      primary: "הוסיפו מדדים כמותיים ושיטת הערכה המבוצעת באופן מחזורי.",
      secondary: "קבעו גורם חיצוני להערכת השפעה ויעילות התוכנית."
    },
    external_audit: {
      primary: "קבעו ביקורת חיצונית עצמאית, מועדים קבועים וחובת פרסום הממצאים.",
      secondary: "הגדירו נהלי טיפול בממצאי הביקורת ומעקב אחר יישום ההמלצות."
    },
    resources: {
      primary: "פרטו את התקציב הנדרש, מקורות המימון וכוח האדם הדרוש לביצוע.",
      secondary: "קבעו מנגנון לבקרת תקציב ורזרבות לטיפול בחריגות עלות."
    },
    multi_levels: {
      primary: "הבהירו את חלוקת האחריות בין הדרגים והחלטות התיאום ביניהם.",
      secondary: "צרו מערכת תקשורת ודיווח בין הרמות השונות עם הגדרת ממשקים."
    },
    structure: {
      primary: "חלקו את התוכנית למשימות ספציפיות עם בעלי תפקידים ואבני דרך ברורות.",
      secondary: "הגדירו מבנה ארגוני ברור עם תיאור תפקידים וסמכויות לכל רמה."
    },
    field_implementation: {
      primary: "תארו בפירוט את היישום בשטח: מי מבצע, איך, באילו סמכויות ופיקוח.",
      secondary: "הקימו מערכת הכשרה ותמיכה למבצעים בשטח עם כלים מעשיים."
    },
    arbitrator: {
      primary: "מנו גורם מכריע עם זמן תגובה ברור לקבלת החלטות וחסימות.",
      secondary: "הגדירו נהלי הסלמה וקבלת החלטות במקרים מורכבים או חריגים."
    },
    cross_sector: {
      primary: "שלבו מנגנון שיתוף ציבור ובעלי עניין רלוונטיים עם תיאום בין-משרדי.",
      secondary: "צרו ועדת היגוי רב-גזרית עם נציגות מכל הגורמים הרלוונטיים."
    },
    outcomes: {
      primary: "הגדירו מדדי תוצאה ברורים ויעדי הצלחה מספריים וניתנים למדידה.",
      secondary: "קבעו מערכת מעקב אחר השפעה ארוכת טווח עם הערכה תקופתית."
    }
  };

  return suggestions[criterionId] || {
    primary: "שפרו את הסעיף בהתאם לדרישות הרובריקה.",
    secondary: "הוסיפו פירוט נוסף ומנגנוני בקרה מתאימים."
  };
}
