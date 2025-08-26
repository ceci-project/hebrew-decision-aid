
// Updated: 2025-08-26 - Added support for suggestion_primary and suggestion_secondary fields
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('Loading secrets...');

// Try all possible secret names and log what we find
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_API_KEY_SECRET') || Deno.env.get('openai_api_key');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID') || Deno.env.get('OPENAI_PROJECT_ID_SECRET') || Deno.env.get('openai_project_id');

console.log('Secrets loaded at startup:', {
  openaiKey: openAIApiKey ? `${openAIApiKey.substring(0, 8)}...` : 'MISSING',
  projectId: openAIProjectId ? `${openAIProjectId.substring(0, 8)}...` : 'MISSING',
  allEnvKeys: Object.keys(Deno.env.toObject()).filter(k => k.toLowerCase().includes('openai'))
});

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
  console.log('analyze-openai function started, method:', req.method, 'time:', new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight for analyze-openai');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const { content, maxInsights = 8 } = await req.json();
    console.log('Request parsed - content length:', content?.length || 0, 'maxInsights:', maxInsights);

    // Check secrets availability
    console.log('Checking secrets availability...');

    // Debug: Check environment variables first
    console.log('Environment check (analyze-openai):', {
      hasOpenaiKey: !!openAIApiKey,
      openaiKeyLength: openAIApiKey?.length || 0,
    });

    if (!openAIApiKey) {
      console.error('Missing OPENAI_API_KEY');
      return new Response(
        JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
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
Return an object with fields: criteria[12], summary, insights[]. See the exact types below.
{
  "criteria": Array<{
    "id": "timeline" | "integrator" | "reporting" | "evaluation" | "external_audit" | "resources" | "multi_levels" | "structure" | "field_implementation" | "arbitrator" | "cross_sector" | "outcomes",
    "name": string,
    "weight": number,            // percentage 0-100 matching the rubric weights
    "score": number,             // integer 0-5
    "justification": string,
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
    "suggestion_primary": string,    // Primary improvement suggestion - actionable and specific
    "suggestion_secondary": string,  // Secondary/alternative improvement suggestion
    "rangeStart": number,
    "rangeEnd": number
  }>
}
Rules:
- Quotes MUST be substrings of the content.
- rangeStart/rangeEnd are [start,end) offsets for the first occurrence; if not found, set both to 0.
- Prefer short quotes (3–8 words).
- Hebrew output where relevant; JSON only, no markdown fences.
- Keep insights to at most ${maxInsights}.
- For each insight, provide both suggestion_primary (main actionable recommendation) and suggestion_secondary (alternative or complementary approach).`;

    const user = `Content (UTF-8 Hebrew allowed):\n"""${content}"""`;

    const model = 'gpt-4o';
    
    console.log('📤 Preparing OpenAI API call:', {
      model,
      contentLength: content.length,
      maxInsights,
      timestamp: new Date().toISOString(),
      hasApiKey: !!openAIApiKey,
      hasProjectId: !!openAIProjectId
    });

    const requestStartTime = Date.now();
    let resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
      },
      body: JSON.stringify({
        model,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'DecisionAnalysis',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                criteria: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string', enum: [
                        'timeline','integrator','reporting','evaluation','external_audit','resources','multi_levels','structure','field_implementation','arbitrator','cross_sector','outcomes'
                      ] },
                      name: { type: 'string' },
                      weight: { type: 'number', minimum: 0, maximum: 100 },
                      score: { type: 'integer', minimum: 0, maximum: 5 },
                      justification: { type: 'string' },
                      evidence: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          properties: {
                            quote: { type: 'string' },
                            rangeStart: { type: 'number' },
                            rangeEnd: { type: 'number' }
                          },
                          required: ['quote','rangeStart','rangeEnd']
                        }
                      }
                    },
                    required: ['id','name','weight','score','justification','evidence']
                  }
                },
                summary: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    feasibilityPercent: { type: 'number', minimum: 0, maximum: 100 },
                    feasibilityLevel: { type: 'string', enum: ['low','medium','high'] },
                    reasoning: { type: 'string' }
                  },
                  required: ['feasibilityPercent','feasibilityLevel','reasoning']
                },
                insights: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      criterionId: { type: 'string', enum: [
                        'timeline','integrator','reporting','evaluation','external_audit','resources','multi_levels','structure','field_implementation','arbitrator','cross_sector','outcomes'
                      ] },
                      quote: { type: 'string' },
                      explanation: { type: 'string' },
                      suggestion: { type: 'string' },
                      suggestion_primary: { type: 'string' },
                      suggestion_secondary: { type: 'string' },
                      rangeStart: { type: 'number' },
                      rangeEnd: { type: 'number' }
                    },
                    required: ['id','criterionId','quote','explanation','suggestion','suggestion_primary','suggestion_secondary','rangeStart','rangeEnd']
                  }
                }
              },
              required: ['criteria','summary','insights']
            }
          }
        },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
      }),
    });

    const requestDuration = Date.now() - requestStartTime;
    console.log('📥 OpenAI API response received:', {
      status: resp.status,
      statusText: resp.statusText,
      duration: `${requestDuration}ms`,
      timestamp: new Date().toISOString()
    });

    let data = await resp.json();
    
    if (!resp.ok) {
      console.error('❌ OpenAI API error response:', {
        status: resp.status,
        error: data?.error?.message || 'Unknown error',
        type: data?.error?.type,
        code: data?.error?.code
      });
      const msg = String(data?.error?.message || '');
      const needsFallback = msg.toLowerCase().includes('response_format') || msg.toLowerCase().includes('json_schema');
      if (needsFallback) {
        const resp2 = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
            ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
          },
          body: JSON.stringify({
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user }
            ],
          }),
        });
        const data2 = await resp2.json();
        if (resp2.ok) {
          resp = resp2;
          data = data2;
        } else {
          console.error('OpenAI error (fallback failed)', data2);
          return new Response(
            JSON.stringify({ error: data2.error?.message || 'OpenAI error (fallback failed)' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        console.error('OpenAI error', data);
        return new Response(
          JSON.stringify({ error: data.error?.message || 'OpenAI error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const text = data.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (_e) {
      parsed = { insights: [], criteria: [], summary: null };
    }

    // Helper function to generate detailed suggestions from basic suggestion
    const generateDetailedSuggestions = (basicSuggestion: string, criterionId: string) => {
      const suggestions: Record<string, { primary: string; secondary: string }> = {
        timeline: {
          primary: "הוסיפו לוח זמנים מפורט עם תאריכי יעד ברורים ומנגנון אכיפה.",
          secondary: "הגדירו אבני דרך ביניים עם נקודות בקרה וסנקציות באי-עמידה."
        },
        integrator: {
          primary: "הקימו צוות מתכלל עם הרכב ברור, סמכויות מוגדרות ותדירות ישיבות קבועה.",
          secondary: "מנו רכז תיאום עליון עם סמכות להכריע בחילוקי דעות בין הגורמים."
        },
        reporting: {
          primary: "קבעו מנגנון דיווח סדור: תדירות, פורמט סטנדרטי וטיפול בחריגות.",
          secondary: "הקימו מערכת מעקב דיגיטלית עם התרעות אוטומטיות ודשבורד מנהלים."
        },
        evaluation: {
          primary: "הגדירו מדדי הצלחה כמותיים ואיכותיים עם שיטת הערכה מחזורית.",
          secondary: "הקימו ועדת הערכה חיצונית עם מנדט ברור ותקציב ייעודי."
        },
        external_audit: {
          primary: "קבעו ביקורת חיצונית שנתית עם חובת פרסום ממצאים ותגובת ההנהלה.",
          secondary: "הטמיעו מנגנון ביקורת עמיתים (peer review) עם גורמים מקצועיים חיצוניים."
        },
        resources: {
          primary: "פרטו את התקציב הנדרש, מקורות המימון והכוח האדם הייעודי.",
          secondary: "הכינו תוכנית גיוס משאבים חלופית ומנגנון לעדכון תקציבי בזמן אמת."
        },
        multi_levels: {
          primary: "הבהירו את חלוקת האחריות בין הדרגים ומנגנוני התיאום הנדרשים.",
          secondary: "הקימו מועצת תיאום עליונה עם נציגות מכל הרמות הרלוונטיות."
        },
        structure: {
          primary: "חלקו את התוכנית למשימות ברורות עם בעלי תפקידים ואבני דרך מוגדרות.",
          secondary: "יצרו מטריצת אחריות (RACI) מפורטת לכל משימה ופעילות."
        },
        field_implementation: {
          primary: "תארו בפירוט את היישום בשטח: מי מבצע, איך, עם אילו סמכויות ופיקוח.",
          secondary: "הכינו מדריך יישום מעשי עם תרחישים, כלים ונהלי פתרון בעיות."
        },
        arbitrator: {
          primary: "מנו גורם מכריע ברור עם SLA מוגדר לקבלת החלטות וסמכות אכיפה.",
          secondary: "הקימו מנגנון בוררות פנימי עם נהלים ברורים לטיפול בסכסוכים."
        },
        cross_sector: {
          primary: "שלבו בעלי עניין רלוונטיים ותיאום בין-משרדי עם מנגנוני שיתוף פעולה.",
          secondary: "הקימו פורום רב-מגזרי עם מנדט ברור ותקציב לפעילות משותפת."
        },
        outcomes: {
          primary: "הגדירו מדדי תוצאה ברורים עם יעדים כמותיים ולוחות זמנים למימוש.",
          secondary: "פתחו מערכת מעקב אחר השפעה ארוכת טווח עם הערכה תקופתית."
        }
      };

      const defaultSuggestions = suggestions[criterionId as keyof typeof suggestions] || {
        primary: basicSuggestion || "שפרו את הסעיף בהתאם לרובריקה.",
        secondary: "הוסיפו מנגנוני בקרה ומעקב נוספים."
      };

      return {
        primary: basicSuggestion || defaultSuggestions.primary,
        secondary: defaultSuggestions.secondary
      };
    };

    let insights = Array.isArray(parsed.insights)
      ? parsed.insights.map((i: any, idx: number) => {
          const basicSuggestion = String(i?.suggestion ?? '');
          const detailedSuggestions = generateDetailedSuggestions(basicSuggestion, i?.criterionId);
          
          return {
            id: String(i?.id ?? `ai-${idx}`),
            criterionId: (ALLOWED_CRITERIA as readonly string[]).includes(i?.criterionId) ? i.criterionId : 'timeline',
            quote: String(i?.quote ?? ''),
            explanation: String(i?.explanation ?? ''),
            suggestion: basicSuggestion,
            suggestion_primary: String(i?.suggestion_primary ?? detailedSuggestions.primary),
            suggestion_secondary: String(i?.suggestion_secondary ?? detailedSuggestions.secondary),
            rangeStart: Number.isFinite(i?.rangeStart) ? i.rangeStart : 0,
            rangeEnd: Number.isFinite(i?.rangeEnd) ? i.rangeEnd : 0,
          };
        })
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
            const detailedSuggestions = generateDetailedSuggestions('', c.id);
            synth.push({
              id: `${c.id}-ev-${k}`,
              criterionId: c.id,
              quote: String(e.quote || ''),
              explanation: c.justification || `חיזוק: ${c.name}`,
              suggestion: `שפרו את הסעיף "${c.name}" בהתאם לרובריקה.`,
              suggestion_primary: detailedSuggestions.primary,
              suggestion_secondary: detailedSuggestions.secondary,
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

    console.log('openai analysis counts', { insights: insights.length, criteria: criteria.length, summary: !!summary, model, withDetailedSuggestions: true });
    return new Response(
      JSON.stringify({ insights, criteria, summary, meta: { source: 'openai', model } }),
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
