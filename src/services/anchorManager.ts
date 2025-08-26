
import { Insight } from '@/types/models';

export class AnchorManager {
  private static CONTEXT_LENGTH = 50; // Characters to capture for prefix/suffix

  static enhanceInsightWithAnchors(insight: Insight, content: string): Insight {
    const start = Math.max(0, insight.rangeStart);
    const end = Math.min(content.length, insight.rangeEnd);
    
    const prefix = content.slice(Math.max(0, start - this.CONTEXT_LENGTH), start);
    const suffix = content.slice(end, Math.min(content.length, end + this.CONTEXT_LENGTH));
    
    return {
      ...insight,
      prefix,
      suffix,
      isStale: false,
      createdAt: insight.createdAt || new Date().toISOString()
    };
  }

  static updateInsightsAfterEdit(
    insights: Insight[],
    changeStart: number,
    changeEnd: number,
    newText: string,
    content: string
  ): Insight[] {
    const lengthDelta = newText.length - (changeEnd - changeStart);
    
    return insights.map(insight => {
      // If insight is completely before the change, no update needed
      if (insight.rangeEnd <= changeStart) {
        return insight;
      }
      
      // If insight is completely after the change, shift positions
      if (insight.rangeStart >= changeEnd) {
        return {
          ...insight,
          rangeStart: insight.rangeStart + lengthDelta,
          rangeEnd: insight.rangeEnd + lengthDelta
        };
      }
      
      // If insight overlaps with the change, try to re-anchor
      return this.reanchorInsight(insight, content);
    });
  }

  static reanchorInsight(insight: Insight, content: string): Insight {
    if (!insight.quote || !insight.prefix || !insight.suffix) {
      return { ...insight, isStale: true };
    }

    // Try to find the quote with context
    const searchPattern = insight.prefix + insight.quote + insight.suffix;
    let index = content.indexOf(searchPattern);
    
    if (index !== -1) {
      const newStart = index + insight.prefix.length;
      const newEnd = newStart + insight.quote.length;
      return {
        ...insight,
        rangeStart: newStart,
        rangeEnd: newEnd,
        isStale: false
      };
    }

    // Try fuzzy matching with just the quote
    index = content.indexOf(insight.quote);
    if (index !== -1) {
      return {
        ...insight,
        rangeStart: index,
        rangeEnd: index + insight.quote.length,
        isStale: false
      };
    }

    // Mark as stale if we can't find it
    return { ...insight, isStale: true };
  }

  static getStalePercentage(insights: Insight[]): number {
    if (insights.length === 0) return 0;
    const staleCount = insights.filter(i => i.isStale).length;
    return (staleCount / insights.length) * 100;
  }
}
