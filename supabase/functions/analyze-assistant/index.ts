import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = "AssistantPath v2025-08-26-Enhanced-60s-Timeout";
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');
const assistantId = Deno.env.get('ASSISTANT_ID');

console.log(`🚀 ${VERSION} - Starting analyze-assistant function`);
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

serve(async (req) => {
  console.log(`📥 ${VERSION} - Request received: ${req.method} at ${new Date().toISOString()}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`✅ ${VERSION} - Handling CORS preflight`);
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 24 } = await req.json();
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

    // Enhanced content handling for long texts
    const isLongText = content.length > 4000;
    const adjustedMaxInsights = isLongText ? Math.max(maxInsights, 32) : maxInsights;
    const truncatedContent = content.length > 15000 ? content.substring(0, 15000) + "..." : content; // Increased limit
    console.log(`📝 ${VERSION} - Content prepared: originalLength=${content.length}, isLongText=${isLongText}, adjustedMaxInsights=${adjustedMaxInsights}, truncatedLength=${truncatedContent.length}`);

    // Enhanced timeout for long texts - increased to 60 seconds
    const timeoutDuration = isLongText ? 60000 : 30000; // 60s for long texts, 30s for normal
    const maxPollingAttempts = isLongText ? 30 : 15; // 30 attempts for long texts (60s total)
    
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      console.log(`🔄 ${VERSION} - Step 1: Creating thread with timeout ${timeoutDuration}ms`);
      
      // Prepare headers - don't include OpenAI-Organization header to avoid the mismatch error
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2',
      };
      
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

      // Enhanced prompt for better Hebrew processing and comprehensive text analysis
      const enhancedPrompt = `נתח את המסמך הממשלתי הבא ותן ביקורת מקיפה על פי רובריקת 12 הקריטריונים.

🔥 הנחיות קריטיות - קרא בקפידה והקפד על יישומן:

1. **ניתוח מלא ומקיף של כל הטקסט**: 
   - נתח את כל חלקי המסמך מתחילתו ועד סופו - זה חובה!
   - וודא שהתובנות מפוזרות על פני כל הטקסט (תחילה 30%, אמצע 40%, סוף 30%)
   - אל תתעלם מהחלקים האחרונים של המסמך - הם לעיתים מכילים פרטים חשובים
   - ${isLongText ? 'טקסט זה ארוך במיוחד - חובה לנתח גם את החלקים המאוחרים!' : ''}

2. **כמות התובנות נדרשת**: צור בדיוק ${adjustedMaxInsights} תובנות מפורטות
   - ${isLongText ? 'עבור טקסט ארוך זה, חובה למצוא תובנות גם מהחלק האחרון של המסמך' : ''}
   - חלק את התובנות באופן שווה בין הקריטריונים השונים
   - כל קריטריון חייב לקבל לפחות 2-3 תובנות

3. **ציטוטים מדויקים ברמה גבוהה**:
   - השתמש בציטוטים קצרים ומדויקים (20-50 תווים בלבד)
   - ציטוט חייב להופיע בדיוק במסמך כפי שאתה מציין
   - הימנע מרווחים מיותרים בתחילת או סוף הציטוט
   - ודא שה-rangeStart וה-rangeEnd מדויקים לחלוטין

4. **עברית בלבד**: כל התוכן חייב להיות בעברית מושלמת ברמה אקדמית!

5. **התמחות בטקסט ממשלתי עברי**:
   - זהה מונחים מקצועיים ממשלתיים
   - התמקד בחסרים מבניים ותהליכיים
   - זהה בעיות בהגדרת אחריות וסמכויות
   - התייחס לחוסר בלוחות זמנים ומנגנוני פיקוח

עבור כל insight, כלול:
- explanation: הסבר ברור ומדויק של הבעיה או החוזקה (30-50 מילים בעברית)
- suggestion: הצעה קצרה לשיפור (15-25 מילים בעברית)  
- suggestion_primary: הצעה מפורטת ראשונית (50-80 מילים בעברית)
- suggestion_secondary: הצעה חלופית או משלימה (50-80 מילים בעברית)
- quote: ציטוט קצר ומדויק מהמסמך (20-50 תווים)
- rangeStart, rangeEnd: מיקום מדויק של הציטוט בטקסט

${isLongText ? `
⚠️ טקסט ארוך - הנחיות נוספות חובה:
- פזר תובנות על פני כל הטקסט: תחילה (30%), אמצע (40%), סוף (30%)
- חובה לנתח גם את החלקים המאוחרים של המסמך
- תן דגש מיוחד לחלק הסופי שלעיתים מכיל פרטי יישום חשובים
- השתמש בציטוטים מייצגים ממקטעים שונים לאורך כל הטקסט
- וודא שיש לך תובנות מכל הקריטריונים גם מהחלק הסופי
` : ''}

תוכן המסמך לניתוח:
"""
${truncatedContent}
"""

החזר רק JSON עם המבנה הבא (ללא טקסט נוסף):
{
  "criteria": [12 קריטריונים עם id, name (בעברית), weight, score, justification (בעברית), evidence],
  "summary": { "feasibilityPercent": מספר, "feasibilityLevel": "low/medium/high", "reasoning": "הסבר בעברית" },
  "insights": [${adjustedMaxInsights} תובנות עם id, criterionId, quote, explanation (בעברית), suggestion (בעברית), suggestion_primary (בעברית), suggestion_secondary (בעברית), rangeStart, rangeEnd]
}

זכור: כל הטקסט בעברית, ${adjustedMaxInsights} תובנות בדיוק, ציטוטים מדויקים וקצרים, כיסוי מלא של הטקסט מתחילתו ועד סופו!`;

      // Step 2: Add a message to the thread
      console.log(`🔄 ${VERSION} - Step 2: Adding enhanced message to thread`);
      const messageResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: 'user',
          content: enhancedPrompt,
        }),
        signal: controller.signal,
      });

      if (!messageResponse.ok) {
        const messageError = await messageResponse.json().catch(() => ({}));
        console.error(`❌ ${VERSION} - Message creation failed:`, messageError);
        throw new Error(`Failed to create message: ${messageError.error?.message || 'Unknown error'}`);
      }

      console.log(`✅ ${VERSION} - Enhanced message added to thread`);

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

      // Step 4: Enhanced polling for completion with progress tracking
      console.log(`🔄 ${VERSION} - Step 4: Enhanced polling (max attempts: ${maxPollingAttempts})`);
      let runStatus = run.status;
      let attempts = 0;

      while (['queued', 'in_progress'].includes(runStatus) && attempts < maxPollingAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        attempts++;
        const progressPercent = Math.round((attempts / maxPollingAttempts) * 100);
        console.log(`🔄 ${VERSION} - Polling attempt ${attempts}/${maxPollingAttempts} (${progressPercent}%), current status: ${runStatus}`);

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
        console.error(`❌ ${VERSION} - Run failed with final status: ${runStatus} after ${attempts} attempts (${attempts * 2}s)`);
        throw new Error(`Analysis timed out or failed with status: ${runStatus} after ${attempts * 2} seconds`);
      }

      console.log(`✅ ${VERSION} - Run completed successfully after ${attempts} polling attempts (${attempts * 2}s)`);

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

      // Enhanced JSON parsing with multiple extraction methods
      let parsed: any;
      try {
        let jsonText = responseText.trim();
        
        // Method 1: Look for JSON blocks in markdown
        const markdownJsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (markdownJsonMatch) {
          jsonText = markdownJsonMatch[1];
        } else {
          // Method 2: Extract the largest JSON object
          const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonText = jsonMatch[0];
          }
        }
        
        parsed = JSON.parse(jsonText);
        console.log(`✅ ${VERSION} - JSON parsed successfully`);
      } catch (parseError) {
        console.error(`❌ ${VERSION} - JSON parse failed:`, parseError);
        console.error(`Raw response (first 500 chars):`, responseText.substring(0, 500));
        // Enhanced fallback structure
        parsed = { insights: [], criteria: [], summary: null };
      }

      // Enhanced processing and validation
      let insights = Array.isArray(parsed.insights)
        ? parsed.insights.slice(0, adjustedMaxInsights).map((i: any, idx: number) => ({
            id: String(i?.id ?? `assistant-${idx}`),
            criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
            quote: String(i?.quote ?? '').trim(), // Trim whitespace from quotes
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
              quote: String(e?.quote ?? '').trim(), // Trim evidence quotes too
              rangeStart: Number.isFinite(e?.rangeStart) ? e.rangeStart : 0,
              rangeEnd: Number.isFinite(e?.rangeEnd) ? e.rangeEnd : 0,
            })) : [],
          }))
        : [];

      // Enhanced synthesis from criteria evidence with better distribution
      if ((!insights || insights.length < adjustedMaxInsights * 0.7) && Array.isArray(criteria)) {
        console.log(`🔄 ${VERSION} - Synthesizing additional insights from criteria evidence`);
        const synth: any[] = [];
        const existingByCrit = new Set(insights.map((i) => i.criterionId));
        
        for (const c of criteria) {
          if (Array.isArray(c.evidence) && c.evidence.length) {
            const evidenceToUse = existingByCrit.has(c.id) ? 1 : Math.min(c.evidence.length, 3); // More evidence per criterion
            for (let k = 0; k < evidenceToUse; k++) {
              const e = c.evidence[k];
              const defaultSuggestions = getDefaultSuggestions(c.id);
              synth.push({
                id: `${c.id}-ev-${k}`,
                criterionId: c.id,
                quote: String(e.quote || '').trim(),
                explanation: c.justification || `תובנה עבור ${c.name}`,
                suggestion: defaultSuggestions.primary,
                suggestion_primary: defaultSuggestions.primary,
                suggestion_secondary: defaultSuggestions.secondary,
                rangeStart: Number.isFinite(e.rangeStart) ? e.rangeStart : 0,
                rangeEnd: Number.isFinite(e.rangeEnd) ? e.rangeEnd : 0,
              });
            }
          }
        }
        
        if (synth.length) {
          insights = [...insights, ...synth].slice(0, adjustedMaxInsights);
          console.log(`✅ ${VERSION} - Added ${synth.length} synthesized insights`);
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

      console.log(`🎉 ${VERSION} - Analysis completed successfully: ${insights.length} insights, ${criteria.length} criteria`);
      console.log(`📊 ${VERSION} - Final stats: { isLongText: ${isLongText}, originalLength: ${content.length}, insights: ${insights.length}, adjustedMaxInsights: ${adjustedMaxInsights}, duration: ${attempts * 2}s }`);

      return new Response(
        JSON.stringify({ 
          insights, 
          criteria, 
          summary, 
          meta: { source: 'assistants', threadId, runId, version: VERSION, isLongText, originalLength: content.length, duration: `${attempts * 2}s` } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (timeoutError) {
      clearTimeout(timeoutId);
      console.error(`⏰ ${VERSION} - Request timeout or abort:`, timeoutError);
      throw timeoutError;
    }

  } catch (error) {
    console.error(`💥 ${VERSION} - Fatal error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || 'Analysis failed', version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Enhanced helper function with more comprehensive suggestions for each criterion in Hebrew
function getDefaultSuggestions(criterionId: string): { primary: string; secondary: string } {
  const suggestions: Record<string, { primary: string; secondary: string }> = {
    timeline: {
      primary: "הוסיפו לוחות זמנים מחייבים עם תאריכי יעד ברורים, אבני דרך ביניים וסנקציות באי-עמידה בהם.",
      secondary: "צרו מערכת מעקב ודיווח שבועית על התקדמות מול הלוח זמנים עם התראות מוקדמות על עיכובים."
    },
    integrator: {
      primary: "הגדירו צוות מתכלל עם הרכב מוגדר, סמכויות ברורות, תדירות ישיבות קבועה ונהלי קבלת החלטות.",
      secondary: "קבעו נהלים ברורים לתיאום בין-משרדי וגורמים שונים עם אחריות מוגדרת ומנגנוני יישוב סכסוכים."
    },
    reporting: {
      primary: "קבעו מנגנון דיווח סדיר: תדירות קבועה, פורמט סטנדרטי, מדדי ביצוע וטיפול בחריגות.",
      secondary: "הקימו מערכת מחוונים דיגיטלית למעקב בזמן אמת אחר התקדמות והישגים עם דשבורד מנהלים."
    },
    evaluation: {
      primary: "הוסיפו מדדים כמותיים ואיכותיים ברורים, שיטת הערכה מחזורית ותיעוד שיטתי של תוצאות.",
      secondary: "קבעו גורם חיצוני עצמאי להערכת השפעה ויעילות התוכנית עם בדיקות איכות תקופתיות."
    },
    external_audit: {
      primary: "קבעו ביקורת חיצונית עצמאית עם מועדים קבועים, מתודולוגיה ברורה וחובת פרסום הממצאים.",
      secondary: "הגדירו נהלי טיפול בממצאי הביקורת, לוחות זמנים ליישום המלצות ומעקב אחר השלמתם."
    },
    resources: {
      primary: "פרטו את התקציב הנדרש לפי שנים ופעילויות, מקורות המימון וכוח האדם הדרוש לביצוע.",
      secondary: "קבעו מנגנון בקרת תקציב שוטף עם רזרבות לטיפול בחריגות עלות ונהלי אישור שינויים."
    },
    multi_levels: {
      primary: "הבהירו את חלוקת האחריות והסמכויות בין הדרגים השונים עם הגדרת ממשקי עבודה ברורים.",
      secondary: "צרו מערכת תקשורת ודיווח היררכית בין הרמות השונות עם הגדרת נהלי הסלמה ותיאום."
    },
    structure: {
      primary: "חלקו את התוכנית למשימות ספציפיות עם בעלי תפקידים מוגדרים, אבני דרך ברורות ומדדי הצלחה.",
      secondary: "הגדירו מבנה ארגוני היררכי עם תיאורי תפקידים מפורטים, סמכויות ברורות ונהלי עבודה לכל רמה."
    },
    field_implementation: {
      primary: "תארו בפירוט את היישום בשטח: מי מבצע, איך, באילו סמכויות, פיקוח ובקרה יומיומית.",
      secondary: "הקימו מערכת הכשרה והדרכה למבצעים בשטח עם כלים מעשיים, מדריכים ותמיכה שוטפת."
    },
    arbitrator: {
      primary: "מנו גורם מכריע בכיר עם זמן תגובה ברור לקבלת החלטות בחסימות וסכסוכים בין-ארגוניים.",
      secondary: "הגדירו נהלי הסלמה מדורגים וקבלת החלטות במקרים מורכבים עם סמכויות חד-משמעיות."
    },
    cross_sector: {
      primary: "שלבו מנגנון שיתוף פעולה עם ציבור ובעלי עניין רלוונטיים, תיאום בין-משרדי וממשק עם מגזר פרטי.",
      secondary: "צרו ועדת היגוי רב-גזרית עם נציגות רחבה מכל הגורמים הרלוונטיים ומנגנון קבלת החלטות קונסנזואלי."
    },
    outcomes: {
      primary: "הגדירו מדדי תוצאה ברורים ויעדי הצלחה מספריים הניתנים למדידה עם לוחות זמנים ספציפיים.",
      secondary: "קבעו מערכת מעקב אחר השפעה ארוכת טווח עם הערכה תקופתית והשוואה למדינות דומות."
    }
  };

  return suggestions[criterionId] || {
    primary: "שפרו את הסעיף בהתאם לדרישות הרובריקה עם פירוט נוסף והגדרות ברורות יותר.",
    secondary: "הוסיפו מנגנוני בקרה ומעקב מתאימים עם הגדרת אחריות ולוחות זמנים לביצוע."
  };
}
