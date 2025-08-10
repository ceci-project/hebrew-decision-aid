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

export async function analyzeDocument(content: string): Promise<Insight[]> {
  if (!content || !content.trim()) return [];

  // Try server-side AI first
  try {
    const { data, error } = await supabase.functions.invoke('analyze-openai', {
      body: { content },
    });
    if (error) throw error;

    const raw = (data as any)?.insights ?? [];
    const insights: Insight[] = (raw as any[]).map((i, idx) => {
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
        criterionId: String(i.criterionId ?? 'legal'),
        quote: String(i.quote ?? ''),
        explanation: String(i.explanation ?? ''),
        suggestion: String(i.suggestion ?? ''),
        rangeStart,
        rangeEnd,
      } satisfies Insight;
    });

    insights.sort((a, b) => a.rangeStart - b.rangeStart);
    return insights;
  } catch (_err) {
    // Fallback: local heuristic analysis
    const rules: Array<{ criterionId: keyof typeof CRITERIA_MAP; terms: string[]; expl: string; sug: string }> = [
      {
        criterionId: "legal",
        terms: ["חוק", "תקנה", "סמכות", "משפט"],
        expl: "נדרש לוודא עמידה במסגרת החוקית והסמכויות הרלוונטיות.",
        sug: "הוסיפו אסמכתא משפטית או הפניה לסעיף חוק רלוונטי.",
      },
      {
        criterionId: "budget",
        terms: ["תקציב", "עלות", "מימון", "הוצאה", "ש\"ח"],
        expl: "נדרשת הערכה תקציבית מפורטת והגדרת מקורות מימון.",
        sug: "הוסיפו טבלת עלויות ומקור תקציבי מאושר.",
      },
      {
        criterionId: "stakeholders",
        terms: ["ציבור", "בעלי עניין", "משרדים", "רשויות", "שיתוף"],
        expl: "יש להתחשב בהשפעה על בעלי עניין ובצורך בתיאום בין-משרדי.",
        sug: "הוסיפו מנגנון שיתוף ציבור/תיאום בין-משרדי מתועד.",
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
    return insights;
  }
}
