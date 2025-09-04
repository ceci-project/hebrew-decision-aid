// Utility function for finding quotes in content
export function findQuoteInContent(content: string, quote: string): { start: number; end: number } {
  if (!quote || !content) return { start: 0, end: 0 };
  
  // Try exact match first
  let pos = content.indexOf(quote);
  if (pos >= 0) {
    return { start: pos, end: pos + quote.length };
  }
  
  // Try trimmed version
  const trimmedQuote = quote.trim();
  pos = content.indexOf(trimmedQuote);
  if (pos >= 0) {
    return { start: pos, end: pos + trimmedQuote.length };
  }
  
  // Try first few words for partial match
  const words = trimmedQuote.split(/\s+/).slice(0, 3).join(' ');
  if (words.length > 5) {
    pos = content.indexOf(words);
    if (pos >= 0) {
      return { start: pos, end: Math.min(content.length, pos + trimmedQuote.length) };
    }
  }
  
  return { start: 0, end: 0 };
}

// Find all occurrences of a quote in content
export function findAllQuotesInContent(content: string, quote: string): Array<{ start: number; end: number }> {
  if (!quote || !content) return [];
  
  const occurrences: Array<{ start: number; end: number }> = [];
  const trimmedQuote = quote.trim();
  let searchStart = 0;
  
  // Find all exact matches
  while (searchStart < content.length) {
    const pos = content.indexOf(trimmedQuote, searchStart);
    if (pos === -1) break;
    
    occurrences.push({ 
      start: pos, 
      end: pos + trimmedQuote.length 
    });
    
    searchStart = pos + 1; // Move past this occurrence
  }
  
  // If no exact matches, try partial match for first occurrence
  if (occurrences.length === 0) {
    const firstMatch = findQuoteInContent(content, quote);
    if (firstMatch.start > 0 || firstMatch.end > 0) {
      occurrences.push(firstMatch);
    }
  }
  
  return occurrences;
}