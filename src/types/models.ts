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
  rangeStart: number;
  rangeEnd: number;
}
