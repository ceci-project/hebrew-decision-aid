
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { storage } from "@/services/storage";
import { analyzeDocument } from "@/services/analysis";
import { CRITERIA, CRITERIA_MAP } from "@/data/criteria";
import { DecisionDocument, Insight } from "@/types/models";
import HighlightCanvas from "@/components/Editor/HighlightCanvas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";

import { Document, Packer, Paragraph } from "docx";
import type { AnalysisMeta } from "@/services/analysis";
import CriterionAccordion from "@/components/Editor/CriterionAccordion";
import FindingsAccordion from "@/components/Editor/FindingsAccordion";

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DecisionDocument | undefined>(() =>
    id ? storage.getDocument(id) : undefined
  );
  const [insights, setInsights] = useState<Insight[]>(() =>
    id ? storage.getInsights(id) : []
  );
  const [tab, setTab] = useState("canvas");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(undefined);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; weight: number; score: number; justification: string }>>([]);
  const [summary, setSummary] = useState<{ feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!doc) {
      toast({ title: "מסמך לא נמצא", description: "חזרה למסך הבית" });
      navigate("/");
    }
  }, [doc, navigate]);

  const onReanalyze = async () => {
    if (!doc) return;
    if (!doc.content.trim()) {
      toast({ title: "אין טקסט לניתוח", description: "אנא הזינו טקסט" });
      return;
    }
    setLoading(true);
    try {
      console.log('🚀 Starting analysis for document:', doc.title);
      const result: any = await analyzeDocument(doc.content);
      console.log('📊 Analysis result received:', {
        hasInsights: Array.isArray(result) || Array.isArray(result?.insights),
        insightsCount: Array.isArray(result) ? result.length : (result?.insights?.length || 0),
        hasCriteria: Array.isArray(result?.criteria),
        criteriaCount: result?.criteria?.length || 0,
        hasSummary: !!result?.summary,
        meta: result?.meta,
        sampleInsight: (Array.isArray(result) ? result[0] : result?.insights?.[0]) ? {
          id: (Array.isArray(result) ? result[0] : result?.insights?.[0]).id,
          suggestion: (Array.isArray(result) ? result[0] : result?.insights?.[0]).suggestion,
          suggestion_primary: (Array.isArray(result) ? result[0] : result?.insights?.[0]).suggestion_primary,
          suggestion_secondary: (Array.isArray(result) ? result[0] : result?.insights?.[0]).suggestion_secondary,
        } : null
      });
      
      const ins: Insight[] = Array.isArray(result)
        ? (result as Insight[])
        : (result?.insights ?? []);
      
      console.log('🔍 Processed insights:', ins.map(i => ({
        id: i.id,
        criterionId: i.criterionId,
        hasSuggestion: !!i.suggestion,
        hasPrimary: !!i.suggestion_primary,
        hasSecondary: !!i.suggestion_secondary
      })));
      
      setInsights(ins);
      setMeta(result?.meta);
      setCriteria(Array.isArray(result?.criteria) ? result.criteria : []);
      setSummary(result?.summary ?? null);
      storage.saveInsights(doc.id, ins);
      toast({ title: "הניתוח הושלם", description: "הודגשים והערות עודכנו" });
    } catch (e) {
      console.error('❌ Analysis failed:', e);
      toast({ title: "שגיאה בניתוח", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const onExportDocx = async () => {
    if (!doc) return;
    const paragraphs = doc.content.split("\n").map((line) => new Paragraph(line));
    const d = new Document({ sections: [{ properties: {}, children: paragraphs }] });
    const blob = await Packer.toBlob(d);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${doc.title || "document"}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  
  const scrollToInsight = (ins: Insight) => {
    setTab("canvas");
    // Wait for tab to render before querying DOM
    requestAnimationFrame(() => {
      const container = (document.getElementById("canvas-scroll") as HTMLDivElement | null) ?? canvasRef.current;

      const findElement = (): HTMLElement | null => {
        // 1) by deterministic ID
        const byId =
          document.getElementById(`hl-${ins.criterionId}-${ins.id}`) ||
          document.getElementById(`hl-${ins.id}`);
        if (byId) return byId as HTMLElement;

        // 2) by data-ins within container
        const byData = container?.querySelector<HTMLElement>(`mark[data-ins="${ins.id}"]`);
        if (byData) return byData;

        // 3) nearest by rangeStart
        if (container) {
          const marks = Array.from(container.querySelectorAll<HTMLElement>("mark[data-start]"));
          let best: HTMLElement | null = null;
          let bestDelta = Number.POSITIVE_INFINITY;
          for (const m of marks) {
            const s = parseInt(m.dataset.start || "0", 10);
            const delta = Math.abs((ins.rangeStart ?? 0) - s);
            if (delta < bestDelta) {
              best = m;
              bestDelta = delta;
            }
          }
          if (best) return best;
        }
        return null;
      };

      const el = findElement();
      if (!el) return;

      // Prefer scrolling inside the canvas container
      if (container) {
        const rect = el.getBoundingClientRect();
        const crect = container.getBoundingClientRect();
        const targetTop = rect.top - crect.top + container.scrollTop - crect.height / 2 + rect.height / 2;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }

      // Temporary visual focus
      el.classList.add("ring-2", "ring-primary/50", "transition-shadow");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50", "transition-shadow"), 1300);
    });
  };

  if (!doc) return null;

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate("/")}
              className="flex items-center text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              חזרה
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{doc.title}</h1>
              <p className="text-sm text-gray-500">עודכן: {new Date(doc.updatedAt).toLocaleDateString('he-IL')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={onExportDocx} variant="outline" size="sm">
              יציאת DOCX
            </Button>
            <Button onClick={onReanalyze} disabled={loading} variant="outline" size="sm">
              {loading ? "מתחת..." : "מתחת..."}
            </Button>
            <Button onClick={onReanalyze} disabled={loading} variant="default" size="sm">
              {loading ? "ניתוח מחדש" : "ניתוח מחדש"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Main Content */}
        <div className="flex-1 p-6">
          <div className="max-w-4xl">
            {/* Document Title Section */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <h2 className="text-xl font-medium text-gray-900">עריכת המסמך</h2>
                <span className="text-sm text-gray-500">{doc.title}</span>
              </div>
              
              {summary && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-800">
                    <strong>ניתוח מחדש</strong>
                    <br />
                    לחץ כדי לנתח מחדש את המסמך עם השינויים שביצעת
                  </div>
                </div>
              )}
            </div>

            {/* Word Count */}
            <div className="mb-4 text-sm text-gray-500">
              מספר תווים: {doc.content.length.toLocaleString()}
            </div>

            {/* Main Text Editor */}
            <div className="bg-white rounded-lg border-2 border-blue-300 p-6">
              <Input
                value={doc.title}
                onChange={(e) => {
                  const updated = { ...doc, title: e.target.value, updatedAt: new Date().toISOString() };
                  setDoc(updated);
                  storage.saveDocument(updated);
                }}
                placeholder="כותרת ההחלטה"
                className="mb-4 text-lg font-medium border-0 border-b border-gray-200 rounded-none px-0 focus:ring-0 focus:border-blue-500"
              />
              
              <Textarea
                className="min-h-[60vh] border-0 resize-none focus:ring-0 text-base leading-relaxed"
                value={doc.content}
                onChange={(e) => {
                  const updated = { ...doc, content: e.target.value, updatedAt: new Date().toISOString() };
                  setDoc(updated);
                  storage.saveDocument(updated);
                }}
                placeholder="כתבו או הדביקו את טקסט ההחלטה כאן..."
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto max-h-screen">
          <div className="p-6">
            <div className="space-y-6">
              {/* Debug Panel */}
              <div className="bg-gray-50 p-3 rounded border text-xs">
                <div className="font-semibold mb-2">🐛 Debug Info:</div>
                <div>Insights: {insights.length}</div>
                <div>Criteria: {criteria.length}</div>
                <div>Summary: {summary ? '✓' : '✗'}</div>
                <div>Meta source: {meta?.source || 'N/A'}</div>
                {insights[0] && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <div className="font-medium">Sample Insight:</div>
                    <div>ID: {insights[0].id}</div>
                    <div>suggestion: {insights[0].suggestion ? '✓' : '✗'}</div>
                    <div>suggestion_primary: {insights[0].suggestion_primary ? '✓' : '✗'}</div>
                    <div>suggestion_secondary: {insights[0].suggestion_secondary ? '✓' : '✗'}</div>
                  </div>
                )}
              </div>

              {/* Feasibility Score */}
              {summary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">ציון כללי:</h4>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {summary.feasibilityPercent}%
                    </div>
                    <div className="text-sm text-gray-500 mb-3">
                      {summary.feasibilityLevel === 'low' ? 'ישימות נמוכה' : 
                       summary.feasibilityLevel === 'medium' ? 'ישימות בינונית' : 
                       'ישימות גבוהה'}
                    </div>
                    <Progress value={summary.feasibilityPercent} className="h-2" />
                  </div>
                  
                  {summary.reasoning && (
                    <p className="mt-4 text-xs text-gray-600 leading-relaxed">
                      {summary.reasoning}
                    </p>
                  )}
                </div>
              )}

              {/* Detailed Criterion Analysis */}
              <div className="border-t border-gray-200 pt-6">
                <CriterionAccordion 
                  criteriaData={criteria} 
                  insights={insights} 
                  onJump={scrollToInsight} 
                />
              </div>

              {/* Analysis Meta */}
              {meta && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="text-xs text-gray-500">
                    {meta.source === 'assistants' ? (
                      <span>
                        מופעל ע״י OpenAI Assistant
                        {meta.model ? ` • ${meta.model}` : ''}
                      </span>
                    ) : meta.source === 'openai' ? (
                      <span>
                        מופעל ע״י OpenAI
                        {meta.model ? ` • ${meta.model}` : ''}
                      </span>
                    ) : (
                      <span>מופעל ע״י ניתוח מקומי</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
