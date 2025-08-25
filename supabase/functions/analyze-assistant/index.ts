// Updated: 2025-08-17 15:30 - Fixed OPENAI_API_KEY issue
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('Loading secrets... Version 3.0 - Force Update');

// Debug ALL environment variables first
console.log('All environment variables:', Object.keys(Deno.env.toObject()));
console.log('OpenAI-related variables:', Object.keys(Deno.env.toObject()).filter(k => k.toLowerCase().includes('openai')));
console.log('Assistant-related variables:', Object.keys(Deno.env.toObject()).filter(k => k.toLowerCase().includes('assistant')));

// Try all possible secret names and log what we find
const openAIApiKey = Deno.env.get('OPENAI_API_KEY') || Deno.env.get('OPENAI_API_KEY_SECRET') || Deno.env.get('openai_api_key');
const assistantId = Deno.env.get('ASSISTANT_ID') || Deno.env.get('ASSISTANT_ID_SECRET') || Deno.env.get('assistant_id');
const openAIProjectId = Deno.env.get('OPENAI_PROJECT_ID') || Deno.env.get('OPENAI_PROJECT_ID_SECRET') || Deno.env.get('openai_project_id');

// Detailed logging of each secret attempt
console.log('Secret resolution attempts:', {
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY') ? 'FOUND' : 'NOT_FOUND',
  OPENAI_API_KEY_SECRET: Deno.env.get('OPENAI_API_KEY_SECRET') ? 'FOUND' : 'NOT_FOUND', 
  openai_api_key: Deno.env.get('openai_api_key') ? 'FOUND' : 'NOT_FOUND',
  ASSISTANT_ID: Deno.env.get('ASSISTANT_ID') ? 'FOUND' : 'NOT_FOUND',
  ASSISTANT_ID_SECRET: Deno.env.get('ASSISTANT_ID_SECRET') ? 'FOUND' : 'NOT_FOUND',
  assistant_id: Deno.env.get('assistant_id') ? 'FOUND' : 'NOT_FOUND',
  finalOpenAIKey: openAIApiKey ? 'RESOLVED' : 'MISSING',
  finalAssistantId: assistantId ? 'RESOLVED' : 'MISSING'
});

console.log('Secrets loaded at startup:', {
  openaiKey: openAIApiKey ? `${openAIApiKey.substring(0, 8)}...` : 'MISSING',
  assistantId: assistantId ? `${assistantId.substring(0, 8)}...` : 'MISSING',
  projectId: openAIProjectId ? `${openAIProjectId.substring(0, 8)}...` : 'MISSING',
  allEnvKeys: Object.keys(Deno.env.toObject()).filter(k => k.toLowerCase().includes('openai') || k.toLowerCase().includes('assistant')),
  rawOpenAIKey: Deno.env.get('OPENAI_API_KEY'),
  rawAssistantId: Deno.env.get('ASSISTANT_ID'),
  allSecrets: Object.keys(Deno.env.toObject())
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

type AllowedId = typeof ALLOWED_CRITERIA[number];

serve(async (req) => {
  console.log('analyze-assistant function started, method:', req.method, 'time:', new Date().toISOString());
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight for analyze-assistant');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Parsing request body...');
    const { content, maxInsights = 8, outputScores = false } = await req.json();
    console.log('Request parsed - content length:', content?.length || 0, 'maxInsights:', maxInsights, 'outputScores:', outputScores);

    // Check secrets availability
    console.log('Checking secrets availability...');

    // Debug: Check environment variables first
    console.log('Environment check:', {
      hasOpenaiKey: !!openAIApiKey,
      openaiKeyLength: openAIApiKey?.length || 0,
      hasAssistantId: !!assistantId,
      assistantIdLength: assistantId?.length || 0,
      assistantIdValue: assistantId || 'UNDEFINED'
    });

    // Validate required environment variables
    if (!openAIApiKey) {
      console.error('Missing OPENAI_API_KEY');
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY environment variable is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!assistantId) {
      console.error('Missing ASSISTANT_ID');
      return new Response(
        JSON.stringify({ error: 'ASSISTANT_ID environment variable is not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (assistantId.trim() === '') {
      console.error('Empty ASSISTANT_ID');
      return new Response(
        JSON.stringify({ error: 'ASSISTANT_ID environment variable is empty' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return new Response(
        JSON.stringify({ insights: [], criteria: [], summary: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the new transformative EditorAI prompt
    const editorDefaults = `DEFAULTS
• edit_mode=transformative  (רמת התערבות גבוהה – מותר לנסח מחדש באופן מקיף מבלי לשנות את הכוונה/המדיניות)
• register=מקצועי‑נהיר 	(עברית בהירה, עניינית, ללא ז׳רגון מיותר; סגנון מינהלי‑מקצועי)
• allow_placeholders=false  (אין להשתמש בתבניות חסר כגון [תאריך], [₪ סכום])
• max_findings=20       	(מספר מרבי של ממצאים להצגה)`;

    const editorPrompt = `ROLE
את/ה EditorAI. תפקידך לשפר נוסח החלטות ממשלה ע"י איתור שורות/סעיפים בעייתיים והצעת ניסוחים מתוקנים — ללא מתן ציונים.
 
INPUT FORMAT
תקבל/י **טקסט החלטה מלא בלבד** (ללא פרמטרים וללא מטא‑דאטה). הטקסט מגיע בין שתי השורות:
BEGIN DECISION
<טקסט ההחלטה>
END DECISION
 
${editorDefaults}
 
METHOD (מהלך עבודה)
1) חלק/י את הטקסט לפסקאות/משפטים וסמן/י עוגנים (Anchor: פסקה N, משפט M).
2) עבור כל אחד מ‑12 התחומים, סרוק/י לאיתור עמימויות/חסרים/אי‑בהירות והפרות של ניסוח מחייב:
   1. לוח זמנים מחייב — חפש/י "בהקדם", "עד סוף השנה" ללא תאריך/חלון זמן; אין SLA/חריגות.
   2. צוות מתכלל — אין גוף מוביל/הרכב/סמכויות/תדירות/הסרת חסמים.
   3. מנגנון דיווח/בקרה — חסרים יעד דיווח, תדירות, פורמט, טיפול בסטיות.
   4. מדידה והערכה — אין מדדים/מתודולוגיה/גוף מבצע/תדירות/שימוש בתובנות.
   5. ביקורת חיצונית — אין גוף חיצוני/מועד/חובת פרסום/סטטוס מחייב.
   6. משאבים נדרשים — סכומים ללא מקור/חלוקה; אין כ"א/התניות תקציב.
   7. מעורבות מספר דרגים — חסר פירוט מדיני/מקצועי/ביצועי ונהלי תיאום.
   8. מבנה סעיפים וחלוקת עבודה — אחריות לא ברורה, ללא אבני דרך.
   9. יישום בשטח — אין מי/איך/סמכויות/פיקוח/מסגרת התקשרות.
   10. גורם מכריע — אין מי מכריע, אין SLA להכרעה, אין חומרי רקע להכרעה.
   11. שותפות בין‑מגזרית — אין מי/מתי/למה, אין מנגנון שיתוף ציבור.
   12. מדדי תוצאה והצלחה — אין יעד מספרי/מסגרת זמן/שיטת מדידה/ספי הצלחה.
3) לכל ממצא:
   • קבע/י חומרה: minor | moderate | critical.
   • הסבר/י בקצרה למה זה בעייתי (כ‑1–2 שורות).
   • הצע/י לפחות ניסוח משופר אחד + חלופה נוספת כשזה מועיל (מיוחד ל‑edit_mode=transformative).
4) שמור/י על כוונת המקור; אל תחליף/י מדיניות או יעדים מהותיים — שפר/י ניסוח, בהירות, מחויבות, מדידות, סמכויות ותזמונים.
5) **אין להשתמש ב‑placeholders**. כשמידע חסר — ניסח/י פתרון שמכוון להוספת מידע אמיתי (למשל דרישת תאריך/סכום) במקום תבנית.
6) הפק/י פלט בשני חלקים: (A) טבלת ממצאים; (B) Patch Blocks (בלוקים של "לפני/אחרי").
 
SUGGESTION TEMPLATES (דוגמאות קצרות)
• לו"ז: "על {הגוף} להשלים {משימה} עד תאריך קונקרטי ולהגיש דוח ל‑{יעד}; סטייה תדווח בתוך X ימים עם תכנית תיקון."
• דיווח: "{הגוף} ידווח ל‑{יעד} אחת ל‑{תדירות} בפורמט {שדות חובה}, לרבות עמידה בלו"ז, סטיות ופעולות מתקנות."
• צוות מתכלל: "יוקם צוות מתכלל בראשות {תפקיד}. חברים: {רשימה}. סמכויות: {סמכויות}. יתכנס אחת ל‑{תדירות}."
• משאבים: "ייוקצו סכומי תקציב מפורטים ממקור {X}; חלוקה לפי {פעולות}; יוקצו {Y} משרות ייעודיות."
• מדדים: "יעד תוצאתי: {מדד}={ערך} עד {תאריך}; מדידה רבעונית ע"י {גוף}; הצלחה חלקית: {X}, מלאה: {Y}."
• הכרעה: "במחלוקת בין {גופים}, יכריע {גורם} תוך X ימים לאחר קבלת עמדות מנומקות."
• יישום בשטח: "{חברה/רשות} תבצע לפי מסגרת התקשרות {סוג}; פיקוח: {גוף}; דוחות: {תדירות}."
 
OUTPUT FORMAT
A) Findings Table (Markdown, עד max_findings רשומות):
# | Anchor | Criterion | Problem | Quote | Severity | Suggestion (primary) | Alternatives | Tags
1 | §3 s1 | לוח זמנים מחייב | אין תאריך יעד | "יושלם בהקדם" | critical | על המשרד… עד תאריך… | דוח חריגה… | לו"ז, עמימות
 
B) Patch Blocks (לכל ממצא):
[Anchor: §3 s1]
מקור: "יושלם בהקדם"
מוצע (מאוזן): "על המשרד להשלים את הכנת התכנית עד תאריך קונקרטי ולהגיש דוח ל‑{יעד}."
מוצע (מורחב): "על המשרד להשלים עד תאריך; סטייה תדווח בתוך X ימים ל‑{יעד}, בצירוף תכנית תיקון."
 
C) Notes (אופציונלי): הנחות, נקודות לא ודאיות, הצעות משלימות.
 
CONSTRAINTS
• אין ציונים, אין סיכום כללי של ההחלטה, ואין שימוש בידע חיצוני.
• שמור/י על סגנון "מקצועי‑נהיר" ונשוא פעיל; מספרים/יחידות מדויקים; עקביות מונחים.
• ציטוטים ≤ 25 מילים.
• אל תדפיס/י הסברים על תהליך פנימי; הצג/י רק ממצאים והצעות.
 
READY`;

    // Send only the formatted text - prompt should be in Assistant settings
    const user = `BEGIN DECISION
${content}
END DECISION`;

    console.log('Sending text to assistant:', user.substring(0, 200) + '...');

    // Create a thread and run with the Assistant (no extra instructions; prompt is self-contained)
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

    // Parse the new EditorAI format with Findings Table and Patch Blocks
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

    // Synthesize insights from criteria evidence if assistant returned none
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

    // Enforce maxInsights cap regardless of format
    if (Array.isArray(insights) && insights.length > maxInsights) {
      insights = insights.slice(0, maxInsights);
    }

    console.log('FINAL RESULTS:', {
      assistantResponse: textContent.substring(0, 500),
      insights: insights.length,
      criteria: criteria.length,
      summary: !!summary,
      parsedContent: JSON.stringify({ insights, criteria, summary }).substring(0, 500)
    });

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
