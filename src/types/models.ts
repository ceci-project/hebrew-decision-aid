
export interface DecisionDocument {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Criterion {
  id: string;
  key: string;
  name: string;
  description: string;
  colorVar: string; // CSS variable name, e.g., --crit-legal
}

export interface Insight {
  id: string;
  criterionId: string;
  quote: string;
  explanation: string;
  suggestion: string;
  suggestion_primary?: string; // הצעה ראשונית
  suggestion_secondary?: string; // הצעה משנית
  rangeStart: number;
  rangeEnd: number;
  // Optional extended fields for EditorAI findings
  anchor?: string;
  severity?: 'minor' | 'moderate' | 'critical';
  alternatives?: string[];
  patchBalanced?: string; // "מוצע (מאוזן)"
  patchExtended?: string; // "מוצע (מורחב)"
}
