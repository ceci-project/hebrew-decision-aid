
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
  version?: string;
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
  
  // Enhanced preprocessing for long texts
  const isLongText = content.length > 4000;
  console.log(`📏 Analysis - Text length: ${content.length}, isLong: ${isLongText}`);
  
  // Try server-side AI first (Assistants), then fallback to OpenAI function
  try {
    const tryInvoke = async (fnName: string) => {
      const requestTimeout = isLongText ? 45000 : 30000; // Longer timeout for long texts
      
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { 
          content, 
          maxInsights: isLongText ? 32 : 24, // More insights for long texts
          outputScores: false,
          chunkSize: isLongText ? 2000 : undefined // Add chunking for long texts
        },
      });
      if (error) throw error;
      return data as any;
    };

    let apiData: any = null;
    
    // First test if functions work at all
    try {
      console.log('Testing simple function...');
      const { data: testData, error: testError } = await supabase.functions.invoke('test-simple', {
        body: { test: true },
      });
      console.log('test-simple result:', testData, testError);
    } catch (e) {
      console.log('test-simple failed:', e);
    }
    
    // Try analyze-assistant first if available, fallback to analyze-openai
    try {
      console.log('Trying analyze-assistant...');
      apiData = await tryInvoke('analyze-assistant');
      console.log('analyze-assistant succeeded:', apiData);
    } catch (e) {
      console.log('analyze-assistant failed, trying analyze-openai...', e);
      try {
        apiData = await tryInvoke('analyze-openai');
        console.log('analyze-openai succeeded:', apiData);
      } catch (e2) {
        console.log('analyze-openai also failed:', e2);
        throw e2;
      }
    }

    const raw: any[] = Array.isArray(apiData?.insights) ? apiData.insights : [];
    const criteria = Array.isArray(apiData?.criteria) ? apiData.criteria : [];
    const summary = apiData?.summary ?? null;
    const meta = apiData?.meta as AnalysisMeta | undefined;

    // Enhanced normalization helpers (memoized per content)
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
      .replace(/[״״״""'']/g, '"') // normalize quotes
      .replace(/[–—−]/g, '-') // normalize dashes
      .split('')
      .filter((ch) => /[\p{L}\p{N}]/u.test(ch))
      .join('');

    const insights: Insight[] = raw.map((i, idx) => {
      const quote = String(i.quote ?? '');
      const clamp = (n: number) => Math.max(0, Math.min(content.length, n));

      const findApprox = (q: string): { start: number; end: number } => {
        if (!q) return { start: 0, end: 0 };
        
        console.log(`🔍 Finding quote: "${q.substring(0, 50)}..."`);
        
        // Step 1: Try exact match
        let pos = content.indexOf(q);
        if (pos >= 0) {
          console.log('✅ Exact match found at:', pos);
          return { start: pos, end: pos + q.length };
        }
        
        // Step 2: Try trimmed version
        const qt = q.trim();
        pos = qt ? content.indexOf(qt) : -1;
        if (pos >= 0) {
          console.log('✅ Trimmed match found at:', pos);
          return { start: pos, end: pos + qt.length };
        }
        
        // Step 3: Try without quotes and special punctuation
        const qClean = qt.replace(/[״״״""'']/g, '"').replace(/[–—−]/g, '-');
        pos = content.indexOf(qClean);
        if (pos >= 0) {
          console.log('✅ Clean match found at:', pos);
          return { start: pos, end: pos + qClean.length };
        }
        
        // Step 4: Try normalized search (ignore quotes/punctuation/spacing/dir marks)
        const { text: normContent, map } = getNormalized();
        const qn = normalize(qt);
        if (qn.length >= 3) { // Lower threshold for Hebrew
          const npos = normContent.indexOf(qn);
          if (npos >= 0) {
            const startOrig = map[npos] ?? 0;
            const endOrig = clamp((map[npos + qn.length - 1] ?? startOrig) + 1);
            console.log('✅ Normalized match found:', { startOrig, endOrig });
            return { start: startOrig, end: endOrig };
          }
        }
        
        // Step 5: Try fuzzy search with word boundaries
        const words = qt.split(/\s+/).filter(w => w.length > 2);
        if (words.length > 0) {
          const firstWord = words[0];
          const firstWordPos = content.indexOf(firstWord);
          if (firstWordPos >= 0) {
            // Look for the quote in a reasonable range around the first word
            const searchStart = Math.max(0, firstWordPos - 100);
            const searchEnd = Math.min(content.length, firstWordPos + qt.length + 200);
            const searchRange = content.substring(searchStart, searchEnd);
            
            // Try to find a partial match
            const partialMatch = searchRange.indexOf(qt.substring(0, Math.min(50, qt.length)));
            if (partialMatch >= 0) {
              const actualStart = searchStart + partialMatch;
              const actualEnd = Math.min(content.length, actualStart + qt.length);
              console.log('✅ Fuzzy match found:', { actualStart, actualEnd });
              return { start: actualStart, end: actualEnd };
            }
          }
        }
        
        // Step 6: Try prefix chunk (helps when the model shortens quotes)
        const chunk = qt.slice(0, Math.min(30, qt.length));
        if (chunk.length >= 6) { // Minimum meaningful chunk
          pos = content.indexOf(chunk);
          if (pos >= 0) {
            console.log('✅ Prefix match found at:', pos);
            return { start: pos, end: clamp(pos + qt.length) };
          }
        }
        
        console.log('❌ No match found for quote');
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
        suggestion_primary: String(i.suggestion_primary ?? ''),
        suggestion_secondary: String(i.suggestion_secondary ?? ''),
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
          const suggestion = getDefaultSuggestion(c.id);
          synthesized.push({
            id: `${c.id}-ev-${k}`,
            criterionId: c.id,
            quote: String(e.quote || ''),
            explanation: c.justification || `חיזוק: ${c.name}`,
            suggestion,
            suggestion_primary: suggestion,
            suggestion_secondary: `הוסיפו מנגנוני בקרה ומעקב נוספים עבור ${c.name}.`,
            rangeStart: Number.isFinite((e as any).rangeStart) ? (e as any).rangeStart : 0,
            rangeEnd: Number.isFinite((e as any).rangeEnd) ? (e as any).rangeEnd : 0,
          });
        }
      }
    }

    const allInsights = [...insights, ...synthesized]
      .sort((a, b) => a.rangeStart - b.rangeStart)
      .slice(0, isLongText ? 32 : 24);

    console.log(`📊 Analysis complete - ${allInsights.length} insights processed`);
    
    return { insights: allInsights, criteria, summary, meta };
  } catch (_err) {
    console.log('🔄 Falling back to local analysis');

    // Fallback: local heuristic analysis
    const rules: Array<{ criterionId: keyof typeof CRITERIA_MAP; terms: string[]; expl: string; sug: string }> = [
      {
        criterionId: "timeline" as any,
        terms: ["תאריך", "דד-ליין", "עד", "תוך", "ימים", "שבועות", "חודשים", "לוח זמנים", "מועד"],
        expl: "נדרש לוודא לוחות זמנים מחייבים ובהירים לביצוע.",
        sug: "הוסיפו תאריכים מחייבים לכל משימה והגדירו מה קורה באי-עמידה.",
      },
      {
        criterionId: "resources" as any,
        terms: ["תקציב", "עלות", "מימון", "הוצאה", "ש\"ח", "כספים", "משאבים", "כוח אדם"],
        expl: "נדרשת הערכה תקציבית מפורטת והגדרת מקורות מימון.",
        sug: "הוסיפו טבלת עלויות, כוח אדם ומקור תקציבי מאושר.",
      },
      {
        criterionId: "cross_sector" as any,
        terms: ["ציבור", "בעלי עניין", "עמות", "חברה אזרחית", "משרדים", "רשויות", "שיתוף", "תיאום"],
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
