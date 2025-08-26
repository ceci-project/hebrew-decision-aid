
// Updated: 2025-08-26 - Simplified and robust version
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const VERSION = "OpenAI-Simplified-v2025-08-26";

console.log(`🚀 ${VERSION} - Loading secrets...`);

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID');

console.log(`${VERSION} - Secrets loaded:`, {
  openaiKey: openAIApiKey ? `${openAIApiKey.substring(0, 8)}...` : 'MISSING',
  projectId: openAIProjectId ? `${openAIProjectId.substring(0, 8)}...` : 'MISSING'
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_CRITERIA = [
  'timeline', 'integrator', 'reporting', 'evaluation', 'external_audit', 'resources',
  'multi_levels', 'structure', 'field_implementation', 'arbitrator', 'cross_sector', 'outcomes'
] as const;

serve(async (req) => {
  console.log(`${VERSION} - Request received:`, req.method, new Date().toISOString());
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content, maxInsights = 24 } = await req.json();
    const isLongText = content && content.length > 4000;
    const adjustedMaxInsights = isLongText ? Math.max(maxInsights, 32) : Math.max(maxInsights, 24);
    
    console.log(`${VERSION} - Processing:`, {
      contentLength: content?.length || 0,
      maxInsights,
      adjustedMaxInsights,
      isLongText
    });

    if (!openAIApiKey) {
      console.error(`${VERSION} - Missing OPENAI_API_KEY`);
      return new Response(
        JSON.stringify({ error: 'Missing OPENAI_API_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || !content.trim()) {
      console.log(`${VERSION} - Empty content, returning default`);
      return new Response(
        JSON.stringify({ 
          insights: [], 
          criteria: [], 
          summary: { feasibilityPercent: 50, feasibilityLevel: 'medium', reasoning: 'לא ניתן לנתח מסמך ריק' }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Much simpler and clearer prompt
    const system = `אתה מומחה לניתוח החלטות ממשלתיות. נתח את המסמך והחזר JSON בלבד עם המבנה הבא:

{
  "criteria": [
    {
      "id": "timeline",
      "name": "לוח זמנים",
      "weight": 10,
      "score": 3,
      "justification": "הסבר בעברית",
      "evidence": [{"quote": "ציטוט", "rangeStart": 0, "rangeEnd": 10}]
    }
  ],
  "summary": {
    "feasibilityPercent": 65,
    "feasibilityLevel": "medium",
    "reasoning": "הסבר כללי בעברית"
  },
  "insights": [
    {
      "id": "1",
      "criterionId": "timeline",
      "quote": "ציטוט קצר מהטקסט",
      "explanation": "הסבר הבעיה בעברית",
      "suggestion": "הצעה קצרה",
      "suggestion_primary": "הצעה מפורטת ראשונית",
      "suggestion_secondary": "הצעה חלופית",
      "rangeStart": 0,
      "rangeEnd": 10
    }
  ]
}

חובה:
- בדיוק ${adjustedMaxInsights} insights
- 12 criteria עם id מרשימה: ${ALLOWED_CRITERIA.join(', ')}
- כל הטקסט בעברית
- JSON תקין בלבד`;

    const user = `נתח את המסמך הבא:\n\n${content}`;

    console.log(`${VERSION} - Calling OpenAI API`);
    const requestStart = Date.now();
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
        ...(openAIProjectId ? { 'OpenAI-Project': openAIProjectId } : {}),
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        max_completion_tokens: 8000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
      }),
    });

    const requestDuration = Date.now() - requestStart;
    console.log(`${VERSION} - OpenAI response:`, {
      status: response.status,
      duration: `${requestDuration}ms`
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`${VERSION} - OpenAI API error:`, errorData);
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '{}';
    
    console.log(`${VERSION} - Raw response length:`, responseText.length);
    console.log(`${VERSION} - Raw response preview:`, responseText.substring(0, 200));

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
      console.log(`${VERSION} - JSON parsed successfully`);
    } catch (parseError) {
      console.error(`${VERSION} - JSON parse failed:`, parseError);
      console.error(`${VERSION} - Raw response:`, responseText);
      
      // Create fallback structure
      parsed = {
        criteria: ALLOWED_CRITERIA.map((id, index) => ({
          id,
          name: getHebrewName(id),
          weight: 8,
          score: 2,
          justification: `נדרש שיפור ב${getHebrewName(id)}`,
          evidence: [{ quote: content.substring(0, 50), rangeStart: 0, rangeEnd: 50 }]
        })),
        summary: {
          feasibilityPercent: 40,
          feasibilityLevel: 'low',
          reasoning: 'הניתוח האוטומטי נכשל, נדרש שיפור כללי'
        },
        insights: []
      };
    }

    // Process and validate data
    const criteria = Array.isArray(parsed.criteria) 
      ? parsed.criteria.slice(0, 12).map((c: any) => ({
          id: ALLOWED_CRITERIA.includes(c?.id) ? c.id : 'timeline',
          name: String(c?.name || getHebrewName(c?.id) || ''),
          weight: Math.max(1, Math.min(15, Number(c?.weight) || 8)),
          score: Math.max(0, Math.min(5, Number(c?.score) || 2)),
          justification: String(c?.justification || ''),
          evidence: Array.isArray(c?.evidence) ? c.evidence.slice(0, 3).map((e: any) => ({
            quote: String(e?.quote || '').substring(0, 100),
            rangeStart: Number(e?.rangeStart) || 0,
            rangeEnd: Number(e?.rangeEnd) || 0,
          })) : [],
        }))
      : ALLOWED_CRITERIA.map(id => ({
          id,
          name: getHebrewName(id),
          weight: 8,
          score: 2,
          justification: `נדרש שיפור ב${getHebrewName(id)}`,
          evidence: [],
        }));

    let insights = Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, adjustedMaxInsights).map((i: any, idx: number) => ({
          id: String(i?.id || `insight-${idx}`),
          criterionId: ALLOWED_CRITERIA.includes(i?.criterionId) ? i.criterionId : 'timeline',
          quote: String(i?.quote || '').substring(0, 100),
          explanation: String(i?.explanation || ''),
          suggestion: String(i?.suggestion || ''),
          suggestion_primary: String(i?.suggestion_primary || i?.suggestion || ''),
          suggestion_secondary: String(i?.suggestion_secondary || ''),
          rangeStart: Number(i?.rangeStart) || 0,
          rangeEnd: Number(i?.rangeEnd) || 0,
        }))
      : [];

    console.log(`${VERSION} - Initial insights count:`, insights.length);

    // Enhanced fallback: create insights from criteria if needed
    if (insights.length < adjustedMaxInsights * 0.5) {
      console.log(`${VERSION} - Creating fallback insights from criteria`);
      const fallbackInsights: any[] = [];
      
      for (const criterion of criteria) {
        const insightsPerCriterion = Math.max(2, Math.floor(adjustedMaxInsights / 12));
        for (let i = 0; i < insightsPerCriterion && fallbackInsights.length < adjustedMaxInsights; i++) {
          const suggestionPair = getDefaultSuggestions(criterion.id);
          fallbackInsights.push({
            id: `${criterion.id}-fallback-${i}`,
            criterionId: criterion.id,
            quote: criterion.evidence?.[0]?.quote || content.substring(i * 100, (i + 1) * 100),
            explanation: criterion.justification || `זוהה חסר ב${criterion.name}`,
            suggestion: suggestionPair.primary,
            suggestion_primary: suggestionPair.primary,
            suggestion_secondary: suggestionPair.secondary,
            rangeStart: i * 100,
            rangeEnd: (i + 1) * 100,
          });
        }
      }
      
      insights = [...insights, ...fallbackInsights].slice(0, adjustedMaxInsights);
      console.log(`${VERSION} - After fallback, insights count:`, insights.length);
    }

    const summary = parsed?.summary ? {
      feasibilityPercent: Math.max(0, Math.min(100, Number(parsed.summary.feasibilityPercent) || 50)),
      feasibilityLevel: ['low','medium','high'].includes(parsed.summary.feasibilityLevel) 
        ? parsed.summary.feasibilityLevel 
        : 'medium',
      reasoning: String(parsed.summary.reasoning || 'ניתוח כללי הושלם'),
    } : {
      feasibilityPercent: 50,
      feasibilityLevel: 'medium' as const,
      reasoning: 'ניתוח כללי הושלם'
    };

    console.log(`${VERSION} - Final result:`, {
      insights: insights.length,
      criteria: criteria.length,
      summary: !!summary,
      duration: `${requestDuration}ms`
    });
    
    return new Response(
      JSON.stringify({ 
        insights, 
        criteria, 
        summary, 
        meta: { 
          source: 'openai', 
          model: 'gpt-5-2025-08-07',
          version: VERSION, 
          isLongText,
          duration: `${requestDuration}ms`,
          adjustedMaxInsights
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`${VERSION} - Fatal error:`, error);
    return new Response(
      JSON.stringify({ error: error.message || 'Analysis failed', version: VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getHebrewName(criterionId: string): string {
  const names: Record<string, string> = {
    timeline: 'לוח זמנים',
    integrator: 'צוות מתכלל',
    reporting: 'דיווח',
    evaluation: 'הערכה',
    external_audit: 'ביקורת חיצונית',
    resources: 'משאבים',
    multi_levels: 'רמות מרובות',
    structure: 'מבנה',
    field_implementation: 'יישום בשטח',
    arbitrator: 'גורם מכריע',
    cross_sector: 'בין-מגזרי',
    outcomes: 'תוצאות'
  };
  return names[criterionId] || criterionId;
}

function getDefaultSuggestions(criterionId: string): { primary: string; secondary: string } {
  const suggestions: Record<string, { primary: string; secondary: string }> = {
    timeline: {
      primary: "הוסיפו לוח זמנים מפורט עם תאריכי יעד ברורים ומנגנון אכיפה.",
      secondary: "הגדירו אבני דרך ביניים עם נקודות בקרה וסנקציות באי-עמידה."
    },
    integrator: {
      primary: "הקימו צוות מתכלל עם הרכב ברור וסמכויות מוגדרות.",
      secondary: "מנו רכז תיאום עליון עם סמכות להכריע בחילוקי דעות."
    },
    reporting: {
      primary: "קבעו מנגנון דיווח סדור עם תדירות ופורמט סטנדרטי.",
      secondary: "הקימו מערכת מעקב דיגיטלית עם התרעות אוטומטיות."
    },
    evaluation: {
      primary: "הגדירו מדדי הצלחה כמותיים ואיכותיים עם הערכה מחזורית.",
      secondary: "הקימו ועדת הערכה חיצונית עם מנדט ברור."
    },
    external_audit: {
      primary: "קבעו ביקורת חיצונית שנתית עם חובת פרסום ממצאים.",
      secondary: "הטמיעו מנגנון ביקורת עמיתים עם גורמים חיצוניים."
    },
    resources: {
      primary: "פרטו את התקציב הנדרש ומקורות המימון הייעודיים.",
      secondary: "הכינו תוכנית גיוס משאבים חלופית."
    },
    multi_levels: {
      primary: "הבהירו את חלוקת האחריות בין הדרגים השונים.",
      secondary: "הקימו מועצת תיאום עליונה עם נציגות מכל הרמות."
    },
    structure: {
      primary: "חלקו את התוכנית למשימות ברורות עם בעלי תפקידים מוגדרים.",
      secondary: "יצרו מטריצת אחריות מפורטת לכל משימה."
    },
    field_implementation: {
      primary: "תארו בפירוט את היישום בשטח עם סמכויות ופיקוח ברורים.",
      secondary: "הכינו מדריך יישום מעשי עם תרחישים וכלים."
    },
    arbitrator: {
      primary: "מנו גורם מכריע ברור עם זמן תגובה מוגדר וסמכות אכיפה.",
      secondary: "הקימו מנגנון בוררות פנימי עם נהלים ברורים."
    },
    cross_sector: {
      primary: "שלבו בעלי עניין רלוונטיים ותיאום בין-משרדי מוגדר.",
      secondary: "הקימו פורום רב-מגזרי עם מנדט ברור."
    },
    outcomes: {
      primary: "הגדירו מדדי תוצאה ברורים עם יעדים כמותיים.",
      secondary: "פתחו מערכת מעקב אחר השפעה ארוכת טווח."
    }
  };
  
  return suggestions[criterionId] || {
    primary: "שפרו את הסעיף בהתאם לרובריקה עם פירוט נוסף.",
    secondary: "הוסיפו מנגנוני בקרה ומעקב נוספים."
  };
}
