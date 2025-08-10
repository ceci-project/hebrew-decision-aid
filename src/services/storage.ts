import { DecisionDocument, Insight } from "@/types/models";

const DOCS_KEY = "da_documents";
const INSIGHTS_KEY_PREFIX = "da_insights_";

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  listDocuments(): DecisionDocument[] {
    const list = readJSON<DecisionDocument[]>(DOCS_KEY, []);
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getDocument(id: string): DecisionDocument | undefined {
    return this.listDocuments().find((d) => d.id === id);
  },

  saveDocument(doc: DecisionDocument) {
    const list = this.listDocuments();
    const idx = list.findIndex((d) => d.id === doc.id);
    if (idx >= 0) list[idx] = doc; else list.push(doc);
    writeJSON(DOCS_KEY, list);
  },

  deleteDocument(id: string) {
    const list = this.listDocuments().filter((d) => d.id !== id);
    writeJSON(DOCS_KEY, list);
    localStorage.removeItem(INSIGHTS_KEY_PREFIX + id);
  },

  getInsights(docId: string): Insight[] {
    return readJSON<Insight[]>(INSIGHTS_KEY_PREFIX + docId, []);
  },

  saveInsights(docId: string, insights: Insight[]) {
    writeJSON(INSIGHTS_KEY_PREFIX + docId, insights);
  },
};
