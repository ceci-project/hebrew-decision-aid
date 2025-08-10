import { Insight } from "@/types/models";
import { CRITERIA_MAP } from "@/data/criteria";
import { supabase } from "@/integrations/supabase/client";

const DELAY_MS = 2000; // 2 seconds before showing results

function pickMatches(content: string, term: string): number[] {
  const idxs: number[] = [];
  let startIndex = 0;
  while (true) {
    const idx = content.indexOf(term, startIndex);
    if (idx === -1) break;
    idxs.push(idx);
    startIndex = idx + term.length;
    if (idxs.length >= 3) break; // limit for demo
  }
  return idxs;
}
export interface AnalysisMeta {
  source: 'assistants' | 'openai' | 'local';
  assistantId?: string;
  runId?: string;
  model?: string | null;
}

export interface AnalysisResult {
  insights: Insight[];
  criteria?: Array<{
    id: string;
    name: string;
    weight: number;
    score: number;
    justification: string;
    evidence?: Array<{ quote: string; rangeStart: number; rangeEnd: number }>;
  }>;
  summary?: { feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null;
  meta?: AnalysisMeta;
}

export async function analyzeDocument(content: string): Promise<AnalysisResult> {
  if (!content || !content.trim()) return { insights: [], meta: { source: 'local' } };
  // Try server-side AI first (Assistants), then fallback to OpenAI function
  try {
    const tryInvoke = async (fnName: string) => {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { content },
      });
      if (error) throw error;
      return data as any;
    };

    let apiData: any = null;
    try {
      apiData = await tryInvoke('analyze-assistant');
    } catch (_e) {
      apiData = await tryInvoke('analyze-openai');
    }

    const raw: any[] = Array.isArray(apiData?.insights) ? apiData.insights : [];
    const criteria = Array.isArray(apiData?.criteria) ? apiData.criteria : [];
    const summary = apiData?.summary ?? null;
    const meta = apiData?.meta as AnalysisMeta | undefined;

    const insights: Insight[] = raw.map((i, idx) => {
      let rangeStart = typeof i.rangeStart === 'number' ? i.rangeStart : 0;
      let rangeEnd = typeof i.rangeEnd === 'number' ? i.rangeEnd : 0;

      if (!i.quote || rangeEnd <= rangeStart) {
        const q = String(i.quote ?? '');
        const idxPos = q ? content.indexOf(q) : -1;
        if (idxPos >= 0) {
          rangeStart = idxPos;
          rangeEnd = idxPos + q.length;
        } else {
          rangeStart = 0;
          rangeEnd = 0;
        }
      }

      return {
        id: String(i.id ?? `ai-${idx}`),
        criterionId: String(i.criterionId ?? 'timeline'),
        quote: String(i.quote ?? ''),
        explanation: String(i.explanation ?? ''),
        suggestion: String(i.suggestion ?? ''),
        rangeStart,
        rangeEnd,
      } satisfies Insight;
    });

    insights.sort((a, b) => a.rangeStart - b.rangeStart);
    return { insights, criteria, summary, meta };
  } catch (_err) {

    // Fallback: local heuristic analysis
    const rules: Array<{ criterionId: keyof typeof CRITERIA_MAP; terms: string[]; expl: string; sug: string }> = [
      {
        criterionId: "timeline" as any,
        terms: ["תאריך", "דד-ליין", "עד", "תוך", "ימים", "שבועות", "חודשים"],
        expl: "נדרש לוודא לוחות זמנים מחייבים ובהירים לביצוע.",
        sug: "הוסיפו תאריכים מחייבים לכל משימה והגדירו מה קורה באי-עמידה.",
      },
      {
        criterionId: "resources" as any,
        terms: ["תקציב", "עלות", "מימון", "הוצאה", "ש\"ח", "כספים"],
        expl: "נדרשת הערכה תקציבית מפורטת והגדרת מקורות מימון.",
        sug: "הוסיפו טבלת עלויות, כוח אדם ומקור תקציבי מאושר.",
      },
      {
        criterionId: "cross_sector" as any,
        terms: ["ציבור", "בעלי עניין", "עמות", "חברה אזרחית", "משרדים", "רשויות", "שיתוף"],
        expl: "יש להתחשב בבעלי עניין ובצורך בשיתופי פעולה בין-מגזריים.",
        sug: "הוסיפו מנגנון שיתוף ציבור ותיאום בין-משרדי/בין-מגזרי מתועד.",
      },
    ];

    const insights: Insight[] = [];

    for (const rule of rules) {
      for (const term of rule.terms) {
        const positions = pickMatches(content, term);
        for (const pos of positions) {
          const start = Math.max(0, pos - 20);
          const end = Math.min(content.length, pos + term.length + 20);
          const quote = content.slice(start, end);
          insights.push({
            id: `${rule.criterionId}-${pos}`,
            criterionId: rule.criterionId,
            quote,
            explanation: rule.expl,
            suggestion: rule.sug,
            rangeStart: pos,
            rangeEnd: pos + term.length,
          });
        }
      }
    }

    insights.sort((a, b) => a.rangeStart - b.rangeStart);
    return { insights, meta: { source: 'local' } };
  }
}
