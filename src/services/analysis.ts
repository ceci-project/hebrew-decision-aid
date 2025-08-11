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
        body: { content, maxInsights: 16 },
      });
      if (error) throw error;
      return data as any;
    };

    let apiData: any = null;
    try {
      apiData = await tryInvoke('analyze-openai');
    } catch (_e) {
      apiData = await tryInvoke('analyze-assistant');
    }

    const raw: any[] = Array.isArray(apiData?.insights) ? apiData.insights : [];
    const criteria = Array.isArray(apiData?.criteria) ? apiData.criteria : [];
    const summary = apiData?.summary ?? null;
    const meta = apiData?.meta as AnalysisMeta | undefined;

    // Robust normalization helpers (memoized per content)
    const getNormalized = (() => {
      let cached: { text: string; map: number[] } | null = null;
      const isKeep = (ch: string) => /[\p{L}\p{N}]/u.test(ch);
      const build = () => {
        const map: number[] = [];
        let text = '';
        for (let i = 0; i < content.length; i++) {
          const ch = content[i];
          if (isKeep(ch)) {
            text += ch.toLowerCase();
            map.push(i);
          }
        }
        return { text, map };
      };
      return () => (cached ??= build());
    })();

    const normalize = (s: string) => (s ?? '')
      .toLowerCase()
      .replace(/[\u200f\u200e\u202a-\u202e]/g, '') // directionality marks
      .split('')
      .filter((ch) => /[\p{L}\p{N}]/u.test(ch))
      .join('');

    const insights: Insight[] = raw.map((i, idx) => {
      const quote = String(i.quote ?? '');
      const clamp = (n: number) => Math.max(0, Math.min(content.length, n));

      const findApprox = (q: string): { start: number; end: number } => {
        if (!q) return { start: 0, end: 0 };
        // exact
        let pos = content.indexOf(q);
        if (pos >= 0) return { start: pos, end: pos + q.length };
        // trimmed
        const qt = q.trim();
        pos = qt ? content.indexOf(qt) : -1;
        if (pos >= 0) return { start: pos, end: pos + qt.length };
        // normalized (ignore quotes/punctuation/spacing/dir marks)
        const { text: normContent, map } = getNormalized();
        const qn = normalize(qt);
        if (qn.length >= 2) {
          const npos = normContent.indexOf(qn);
          if (npos >= 0) {
            const startOrig = map[npos] ?? 0;
            const endOrig = clamp((map[npos + qn.length - 1] ?? startOrig) + 1);
            return { start: startOrig, end: endOrig };
          }
        }
        // prefix chunk (helps when the model shortens quotes)
        const chunk = qt.slice(0, Math.min(24, qt.length));
        if (chunk.length >= 4) {
          pos = content.indexOf(chunk);
          if (pos >= 0) return { start: pos, end: clamp(pos + qt.length) };
        }
        return { start: 0, end: 0 };
      };

      let rangeStart = typeof i.rangeStart === 'number' ? clamp(i.rangeStart) : 0;
      let rangeEnd = typeof i.rangeEnd === 'number' ? clamp(i.rangeEnd) : 0;

      const providedMatches =
        !!quote &&
        rangeEnd > rangeStart &&
        content.slice(rangeStart, rangeEnd) === quote;

      if (!providedMatches) {
        const approx = findApprox(quote);
        rangeStart = approx.start;
        rangeEnd = approx.end;
      }

      return {
        id: String(i.id ?? `ai-${idx}`),
        criterionId: (() => {
          const raw = (i.criterionId ?? (i as any).category ?? (i as any).key ?? '')
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[\u200f\u200e\u202a-\u202e]/g, '')
            .replace(/[^a-z\u05d0-\u05ea0-9]+/gi, '_')
            .replace(/^_+|_+$/g, '');
          const alias: Record<string, string> = {
            field_implementation: 'field_implementation',
            'field-implementation': 'field_implementation',
            fieldimplementation: 'field_implementation',
            in_field: 'field_implementation',
            operational_implementation: 'field_implementation',
            arbitrator: 'arbitrator',
            arbiter: 'arbitrator',
            decider: 'arbitrator',
            decision_maker: 'arbitrator',
            cross_sector: 'cross_sector',
            'cross-sector': 'cross_sector',
            intersectoral: 'cross_sector',
            multi_sector: 'cross_sector',
            partnership: 'cross_sector',
            stakeholder_engagement: 'cross_sector',
            public_participation: 'cross_sector',
            outcomes: 'outcomes',
            outcome_metrics: 'outcomes',
            success_metrics: 'outcomes',
            kpis: 'outcomes',
            results_metrics: 'outcomes',
          };
          if (alias[raw]) return alias[raw];
          if (CRITERIA_MAP[raw as keyof typeof CRITERIA_MAP]) return raw;
          for (const key of Object.keys(CRITERIA_MAP)) {
            if (raw.includes(key) || key.includes(raw)) return key;
          }
          return 'timeline';
        })(),
        quote,
        explanation: String(i.explanation ?? ''),
        suggestion: String(i.suggestion ?? ''),
        rangeStart,
        rangeEnd,
        anchor: i.anchor ? String(i.anchor) : undefined,
        severity: ['minor','moderate','critical'].includes(i?.severity) ? i.severity : undefined,
        alternatives: Array.isArray(i?.alternatives)
          ? i.alternatives.map((s: any) => String(s)).filter(Boolean)
          : (typeof i?.alternatives === 'string' && i.alternatives
              ? String(i.alternatives).split(/;|\u200f|\|/).map((s) => s.trim()).filter(Boolean)
              : undefined),
        patchBalanced: i?.patchBalanced ? String(i.patchBalanced) : undefined,
        patchExtended: i?.patchExtended ? String(i.patchExtended) : undefined,
      } satisfies Insight;
    });

    // Synthesize insights from criteria evidence when missing for a criterion
    const getDefaultSuggestion = (id: string) => {
      const map: Record<string, string> = {
        timeline: "הוסיפו לוח זמנים מחייב עם תאריכי יעד וסנקציות באי-עמידה.",
        integrator: "הגדירו צוות מתכלל: הרכב, סמכויות, ותדירות ישיבות.",
        reporting: "קבעו מנגנון דיווח: תדירות, פורמט וטיוב חריגות.",
        evaluation: "הוסיפו מדדים ושיטת הערכה המבוצעת באופן מחזורי.",
        external_audit: "קבעו ביקורת חיצונית, מועד וחובת פרסום.",
        resources: "פירוט תקציב, מקורות מימון וכוח אדם נדרש.",
        multi_levels: "הבהירו אחריות בין הדרגים והחלטות תיאום.",
        structure: "חלקו למשימות/בעלי תפקידים עם אבני דרך ברורות.",
        field_implementation: "תארו את היישום בשטח: מי, איך, סמכויות ופיקוח.",
        arbitrator: "מנו גורם מכריע עם SLA לקבלת החלטות.",
        cross_sector: "שלבו שיתוף ציבור/מגזרים רלוונטיים ותיאום בין-משרדי.",
        outcomes: "הגדירו מדדי תוצאה ברורים ויעדי הצלחה מספריים."
      };
      return map[id] || "שפרו את הסעיף בהתאם לרובריקה.";
    };

    const existingByCrit = new Set(insights.map((i) => i.criterionId));
    const synthesized: Insight[] = [];
    for (const c of criteria) {
      if (!existingByCrit.has(c.id) && Array.isArray(c.evidence) && c.evidence.length) {
        for (let k = 0; k < Math.min(c.evidence.length, 2); k++) {
          const e = c.evidence[k];
          synthesized.push({
            id: `${c.id}-ev-${k}`,
            criterionId: c.id,
            quote: String(e.quote || ''),
            explanation: c.justification || `חיזוק: ${c.name}`,
            suggestion: getDefaultSuggestion(c.id),
            rangeStart: Number.isFinite((e as any).rangeStart) ? (e as any).rangeStart : 0,
            rangeEnd: Number.isFinite((e as any).rangeEnd) ? (e as any).rangeEnd : 0,
          });
        }
      }
    }

    const allInsights = [...insights, ...synthesized]
      .sort((a, b) => a.rangeStart - b.rangeStart)
      .slice(0, 24);

    return { insights: allInsights, criteria, summary, meta };
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
