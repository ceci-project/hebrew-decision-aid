
import { Insight } from "@/types/models";
import { CRITERIA_MAP } from "@/data/criteria";
import { supabase } from "@/integrations/supabase/client";

const DELAY_MS = 1000; // Reduced delay for better UX

export interface AnalysisMeta {
  source: 'assistants' | 'openai' | 'local';
  model?: string;
  version?: string;
  duration?: string;
  adjustedMaxInsights?: number;
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
  if (!content || !content.trim()) {
    return { 
      insights: [], 
      meta: { source: 'local' },
      summary: { feasibilityPercent: 0, feasibilityLevel: 'low', reasoning: 'לא ניתן לנתח מסמך ריק' }
    };
  }
  
  const isLongText = content.length > 4000;
  const targetInsights = isLongText ? 32 : 24;
  
  console.log(`📏 Analysis starting - Text: ${content.length} chars, Target: ${targetInsights} insights`);
  
  try {
    console.log('🤖 Trying AI analysis...');
    
    const tryInvoke = async (fnName: string, timeout: number) => {
      console.log(`📡 Calling ${fnName} with ${timeout}ms timeout`);
      
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { 
          content, 
          maxInsights: targetInsights
        },
      });
      
      if (error) {
        console.error(`❌ ${fnName} error:`, error);
        throw error;
      }
      
      console.log(`✅ ${fnName} success:`, {
        insights: data?.insights?.length || 0,
        criteria: data?.criteria?.length || 0,
        source: data?.meta?.source
      });
      
      return data;
    };

    let apiData: any = null;
    
    // Try analyze-assistant first (shorter timeout), then fallback to analyze-openai
    try {
      console.log('🔄 Trying analyze-assistant (faster method)...');
      apiData = await tryInvoke('analyze-assistant', 45000);
      
      // Check if we got good results
      if (!apiData?.insights || apiData.insights.length < targetInsights * 0.3) {
        console.log('⚠️ analyze-assistant returned insufficient insights, trying analyze-openai...');
        throw new Error('Insufficient insights from assistant');
      }
      
    } catch (assistantError) {
      console.log('🔄 analyze-assistant failed, trying analyze-openai...', assistantError.message);
      try {
        apiData = await tryInvoke('analyze-openai', 60000);
      } catch (openaiError) {
        console.error('❌ Both AI methods failed:', { assistantError: assistantError.message, openaiError: openaiError.message });
        throw openaiError;
      }
    }

    const rawInsights: any[] = Array.isArray(apiData?.insights) ? apiData.insights : [];
    const criteria = Array.isArray(apiData?.criteria) ? apiData.criteria : [];
    const summary = apiData?.summary ?? null;
    const meta = apiData?.meta as AnalysisMeta | undefined;

    console.log(`📊 Processing ${rawInsights.length} raw insights`);

    // Enhanced quote finding with better fuzzy matching
    const findQuotePosition = (quote: string, originalContent: string): { start: number; end: number } => {
      if (!quote || !originalContent) return { start: 0, end: 0 };
      
      // Try exact match first
      let pos = originalContent.indexOf(quote);
      if (pos >= 0) return { start: pos, end: pos + quote.length };
      
      // Try trimmed version
      const trimmed = quote.trim();
      pos = originalContent.indexOf(trimmed);
      if (pos >= 0) return { start: pos, end: pos + trimmed.length };
      
      // Try normalized version (remove quotes, dashes, etc.)
      const normalized = quote.replace(/[״״״""''–—−]/g, '"').replace(/\s+/g, ' ').trim();
      pos = originalContent.indexOf(normalized);
      if (pos >= 0) return { start: pos, end: pos + normalized.length };
      
      // Try first significant words
      const words = quote.split(/\s+/).filter(w => w.length > 3);
      if (words.length > 0) {
        const firstWord = words[0];
        pos = originalContent.indexOf(firstWord);
        if (pos >= 0) {
          return { start: pos, end: Math.min(originalContent.length, pos + quote.length) };
        }
      }
      
      return { start: 0, end: 0 };
    };

    // Process insights with better validation
    const insights: Insight[] = rawInsights.map((i, idx) => {
      const quote = String(i.quote ?? '').trim();
      const { start, end } = findQuotePosition(quote, content);
      
      return {
        id: String(i.id ?? `ai-${idx}`),
        criterionId: (() => {
          const id = i.criterionId?.toString().toLowerCase().trim() || '';
          const validCriteria = Object.keys(CRITERIA_MAP);
          
          if (validCriteria.includes(id)) return id;
          
          // Try fuzzy matching
          for (const validId of validCriteria) {
            if (id.includes(validId) || validId.includes(id)) return validId;
          }
          
          return 'timeline'; // fallback
        })(),
        quote,
        explanation: String(i.explanation ?? ''),
        suggestion: String(i.suggestion ?? ''),
        suggestion_primary: String(i.suggestion_primary ?? i.suggestion ?? ''),
        suggestion_secondary: String(i.suggestion_secondary ?? ''),
        rangeStart: start,
        rangeEnd: end,
        severity: ['minor','moderate','critical'].includes(i?.severity) ? i.severity : undefined,
        alternatives: Array.isArray(i?.alternatives) 
          ? i.alternatives.map(String).filter(Boolean)
          : undefined,
      } satisfies Insight;
    });

    // Enhanced fallback logic - ensure minimum insights per criterion
    const getMinInsightsPerCriterion = (totalTarget: number) => Math.max(1, Math.floor(totalTarget / 12));
    const minPerCriterion = getMinInsightsPerCriterion(targetInsights);
    
    const insightsByCriterion = new Map<string, Insight[]>();
    for (const insight of insights) {
      const list = insightsByCriterion.get(insight.criterionId) || [];
      list.push(insight);
      insightsByCriterion.set(insight.criterionId, list);
    }
    
    // Add fallback insights for criteria with too few insights
    const fallbackInsights: Insight[] = [];
    for (const criterion of criteria) {
      const existing = insightsByCriterion.get(criterion.id) || [];
      const needed = minPerCriterion - existing.length;
      
      if (needed > 0 && criterion.evidence?.length) {
        for (let i = 0; i < Math.min(needed, criterion.evidence.length); i++) {
          const evidence = criterion.evidence[i];
          const suggestions = getDefaultSuggestion(criterion.id);
          
          fallbackInsights.push({
            id: `${criterion.id}-fallback-${i}`,
            criterionId: criterion.id,
            quote: evidence.quote || `מתוך הקטע בעמוד ${Math.floor(evidence.rangeStart / 1000) + 1}`,
            explanation: criterion.justification || `זוהה צורך בשיפור ב${criterion.name}`,
            suggestion: suggestions.primary,
            suggestion_primary: suggestions.primary,
            suggestion_secondary: suggestions.secondary,
            rangeStart: evidence.rangeStart,
            rangeEnd: evidence.rangeEnd,
          });
        }
      }
    }
    
    const allInsights = [...insights, ...fallbackInsights]
      .sort((a, b) => a.rangeStart - b.rangeStart)
      .slice(0, targetInsights);

    console.log(`🎯 Final result: ${allInsights.length} insights, ${criteria.length} criteria`);
    console.log(`📈 Analysis completed with ${meta?.source} in ${meta?.duration || 'unknown time'}`);
    
    // Add a small delay to show the processing state
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    
    return { 
      insights: allInsights, 
      criteria, 
      summary: summary || {
        feasibilityPercent: criteria.length ? Math.round(criteria.reduce((acc, c) => acc + (c.score / 5 * c.weight), 0) / criteria.reduce((acc, c) => acc + c.weight, 0) * 100) : 50,
        feasibilityLevel: 'medium' as const,
        reasoning: 'ניתוח הושלם בהצלחה'
      }, 
      meta 
    };
    
  } catch (error) {
    console.error('🔴 Analysis failed, using local fallback:', error);

    // Enhanced local fallback
    const localInsights = createLocalFallbackInsights(content, targetInsights);
    
    return { 
      insights: localInsights, 
      meta: { source: 'local' },
      summary: {
        feasibilityPercent: 30,
        feasibilityLevel: 'low',
        reasoning: 'הניתוח האוטומטי נכשל, נוצרו תובנות בסיסיות על בסיס חיפוש מילות מפתח'
      }
    };
  }
}

function getDefaultSuggestion(criterionId: string): { primary: string; secondary: string } {
  const suggestions: Record<string, { primary: string; secondary: string }> = {
    timeline: {
      primary: "הוסיפו לוח זמנים מחייב עם תאריכי יעד ברורים וסנקציות באי-עמידה.",
      secondary: "צרו מערכת מעקב ודיווח שבועית על התקדמות מול הלוח זמנים."
    },
    integrator: {
      primary: "הגדירו צוות מתכלל עם הרכב מוגדר וסמכויות ברורות.",
      secondary: "קבעו נהלים ברורים לתיאום בין-משרדי וגורמים שונים."
    },
    reporting: {
      primary: "קבעו מנגנון דיווח סדיר עם תדירות קבועה ופורמט סטנדרטי.",
      secondary: "הקימו מערכת מחוונים דיגיטלית למעקב בזמן אמת."
    },
    evaluation: {
      primary: "הוסיפו מדדים כמותיים ואיכותיים ברורים ושיטת הערכה מחזורית.",
      secondary: "קבעו גורם חיצוני עצמאי להערכת השפעה ויעילות."
    },
    external_audit: {
      primary: "קבעו ביקורת חיצונית עצמאית עם מועדים קבועים וחובת פרסום ממצאים.",
      secondary: "הגדירו נהלי טיפול בממצאי הביקורת ומעקב אחר יישום המלצות."
    },
    resources: {
      primary: "פרטו את התקציב הנדרש לפי שנים ופעילויות ומקורות המימון.",
      secondary: "קבעו מנגנון בקרת תקציב שוטף עם רזרבות לחריגות עלות."
    },
    multi_levels: {
      primary: "הבהירו את חלוקת האחריות והסמכויות בין הדרגים השונים.",
      secondary: "צרו מערכת תקשורת ודיווח היררכית בין הרמות השונות."
    },
    structure: {
      primary: "חלקו את התוכנית למשימות ספציפיות עם בעלי תפקידים מוגדרים.",
      secondary: "הגדירו מבנה ארגוני היררכי עם תיאורי תפקידים מפורטים."
    },
    field_implementation: {
      primary: "תארו בפירוט את היישום בשטח: מי מבצע, איך, באילו סמכויות.",
      secondary: "הקימו מערכת הכשרה והדרכה למבצעים בשטח עם כלים מעשיים."
    },
    arbitrator: {
      primary: "מנו גורם מכריע בכיר עם זמן תגובה ברור לקבלת החלטות.",
      secondary: "הגדירו נהלי הסלמה מדורגים וקבלת החלטות במקרים מורכבים."
    },
    cross_sector: {
      primary: "שלבו מנגנון שיתוף פעולה עם ציבור ובעלי עניין רלוונטיים.",
      secondary: "צרו ועדת היגוי רב-גזרית עם נציגות רחבה מכל הגורמים הרלוונטיים."
    },
    outcomes: {
      primary: "הגדירו מדדי תוצאה ברורים ויעדי הצלחה מספריים הניתנים למדידה.",
      secondary: "קבעו מערכת מעקב אחר השפעה ארוכת טווח עם הערכה תקופתית."
    }
  };

  return suggestions[criterionId] || {
    primary: "שפרו את הסעיף בהתאם לדרישות הרובריקה עם פירוט נוסף.",
    secondary: "הוסיפו מנגנוני בקרה ומעקב מתאימים לשיפור הביצוע."
  };
}

function createLocalFallbackInsights(content: string, targetCount: number): Insight[] {
  const rules = [
    {
      criterionId: "timeline" as keyof typeof CRITERIA_MAP,
      terms: ["תאריך", "דד-ליין", "לוח זמנים", "מועד", "עד יום", "תוך"],
      explanation: "נדרש לוודא לוחות זמנים מחייבים ובהירים לביצוע."
    },
    {
      criterionId: "resources" as keyof typeof CRITERIA_MAP,
      terms: ["תקציב", "עלות", "מימון", "ש\"ח", "כספים", "משאבים"],
      explanation: "נדרשת הערכה תקציבית מפורטת והגדרת מקורות מימון."
    },
    {
      criterionId: "cross_sector" as keyof typeof CRITERIA_MAP,
      terms: ["ציבור", "בעלי עניין", "עמותות", "שיתוף", "תיאום", "משרדים"],
      explanation: "יש להתחשב בבעלי עניין ובצורך בשיתופי פעולה בין-מגזריים."
    }
  ];

  const insights: Insight[] = [];
  
  for (const rule of rules) {
    for (const term of rule.terms) {
      let startIndex = 0;
      while (insights.length < targetCount) {
        const pos = content.indexOf(term, startIndex);
        if (pos === -1) break;
        
        const start = Math.max(0, pos - 30);
        const end = Math.min(content.length, pos + term.length + 30);
        const quote = content.slice(start, end).trim();
        const suggestions = getDefaultSuggestion(rule.criterionId);
        
        insights.push({
          id: `local-${rule.criterionId}-${pos}`,
          criterionId: rule.criterionId,
          quote,
          explanation: rule.explanation,
          suggestion: suggestions.primary,
          suggestion_primary: suggestions.primary,
          suggestion_secondary: suggestions.secondary,
          rangeStart: pos,
          rangeEnd: pos + term.length,
        });
        
        startIndex = pos + term.length;
        if (insights.length >= targetCount) break;
      }
      if (insights.length >= targetCount) break;
    }
    if (insights.length >= targetCount) break;
  }

  return insights.slice(0, targetCount);
}
