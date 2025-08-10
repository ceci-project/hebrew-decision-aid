import { Insight } from "@/types/models";
import { CRITERIA_MAP } from "@/data/criteria";

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

  // Synthetic heuristic-based insights (placeholder until backend + OpenAI Assistant is connected)
  const rules: Array<{ criterionId: keyof typeof CRITERIA_MAP; terms: string[]; expl: string; sug: string }>= [
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

  // Sort by position
  insights.sort((a, b) => a.rangeStart - b.rangeStart);

  // Simulate processing delay
  await new Promise((res) => setTimeout(res, DELAY_MS));

  return insights;
}
