import { Insight } from "@/types/models";
import { CRITERIA_MAP, CRITERIA } from "@/data/criteria";
import { findQuoteInContent } from "./quoteUtils";

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
  source: 'assistants' | 'local' | 'openai';
  assistantId?: string;
  runId?: string;
  model?: string | null;
  version?: string;
  failedCriteria?: string[];
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

// Local functions proxy URL
const functionsUrl = import.meta.env.VITE_LOCAL_FUNCTIONS_URL || '/functions';

export async function analyzeDocument(content: string, maxInsights: number = 6): Promise<AnalysisResult> {
  console.log('🤖 Starting document analysis with local functions');
  
  try {
    const response = await fetch(`${functionsUrl}/v1/analyze-openai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, maxInsights })
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    
    console.log('📊 ANALYSIS DEBUG - Raw result from functions:', {
      hasCriteria: !!result.criteria,
      criteriaLength: result.criteria?.length || 0,
      criteriaStructure: result.criteria?.slice(0, 2) || [],
      hasInsights: !!result.insights,
      insightsLength: result.insights?.length || 0
    });
    
    // Ensure insights have proper ranges
    const insights = (result.insights || []).map((insight: any, index: number) => {
      // Handle multiple quotes if present
      if (Array.isArray(insight.quotes)) {
        // Process each quote to find its position and preserve IDs
        const processedQuotes = insight.quotes.map((q: any, qIdx: number) => {
          const range = findQuoteInContent(content, q.text || q.quote || '');
          return {
            id: q.id || `${insight.criterionId}-${index}-q${qIdx}`,
            text: q.text || q.quote || '',
            rangeStart: range?.start ?? q.rangeStart ?? 0,
            rangeEnd: range?.end ?? q.rangeEnd ?? 0,
            prefix: q.prefix,
            suffix: q.suffix
          };
        }).sort((a: any, b: any) => a.rangeStart - b.rangeStart); // Sort by position
        
        // Use first quote for backward compatibility fields
        const firstQuote = processedQuotes[0] || { text: '', rangeStart: 0, rangeEnd: 0 };
        
        return {
          ...insight,
          id: insight.id || `insight-${index}`,
          quotes: processedQuotes,
          quote: firstQuote.text,
          rangeStart: firstQuote.rangeStart,
          rangeEnd: firstQuote.rangeEnd
        };
      } else {
        // Single quote handling (backward compatibility)
        const range = findQuoteInContent(content, insight.quote || '');
        return {
          ...insight,
          id: insight.id || `insight-${index}`,
          rangeStart: range?.start ?? insight.rangeStart ?? 0,
          rangeEnd: range?.end ?? insight.rangeEnd ?? 0
        };
      }
    });

    const finalResult = {
      insights,
      criteria: result.criteria || [],
      summary: result.summary || null,
      meta: result.meta || { source: 'openai', version: 'local' }
    };
    
    console.log('📊 ANALYSIS DEBUG - Final processed result:', {
      criteriaLength: finalResult.criteria.length,
      criteriaIds: finalResult.criteria.map((c: any) => c.id),
      criteriaScores: finalResult.criteria.map((c: any) => ({ id: c.id, score: c.score }))
    });
    
    return finalResult;
  } catch (error) {
    console.error('❌ Analysis error:', error);
    throw error;
  }
}
