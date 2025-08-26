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
  const [doc, setDoc] = useState<DecisionDocument | undefined>(undefined);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [tab, setTab] = useState("canvas");
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(undefined);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; weight: number; score: number; justification: string }>>([]);
  const [summary, setSummary] = useState<{ feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const UI_VERSION = "App v2025-08-26-UI-6-Editor";

  // Load document on component mount
  useEffect(() => {
    console.log(`🚀 ${UI_VERSION} - Editor page loaded with ID: ${id}`);
    
    if (!id) {
      console.error(`❌ ${UI_VERSION} - No document ID provided`);
      toast({ title: "מסמך לא נמצא", description: "חזרה למסך הבית" });
      navigate("/");
      return;
    }

    // Load document from storage
    const loadedDoc = storage.getDocument(id);
    console.log(`📄 ${UI_VERSION} - Loaded document:`, loadedDoc ? {
      id: loadedDoc.id,
      title: loadedDoc.title,
      contentLength: loadedDoc.content.length,
      createdAt: loadedDoc.createdAt
    } : 'Document not found');

    if (!loadedDoc) {
      console.error(`❌ ${UI_VERSION} - Document not found in storage for ID: ${id}`);
      toast({ title: "מסמך לא נמצא", description: "חזרה למסך הבית" });
      navigate("/");
      return;
    }

    setDoc(loadedDoc);

    // Load insights from storage
    const loadedInsights = storage.getInsights(id);
    console.log(`🔍 ${UI_VERSION} - Loaded insights:`, loadedInsights.length);
    setInsights(loadedInsights);

  }, [id, navigate]);

  const onReanalyze = async () => {
    if (!doc) return;
    if (!doc.content.trim()) {
      toast({ title: "אין טקסט לניתוח", description: "אנא הזינו טקסט" });
      return;
    }
    setLoading(true);
    try {
      console.log(`🚀 ${UI_VERSION} - Starting analysis for document:`, doc.title);
      console.log(`📊 ${UI_VERSION} - Document content length:`, doc.content.length);
      
      const result: any = await analyzeDocument(doc.content);
      console.log(`📊 ${UI_VERSION} - Analysis result received:`, {
        hasInsights: Array.isArray(result) || Array.isArray(result?.insights),
        insightsCount: Array.isArray(result) ? result.length : (result?.insights?.length || 0),
        hasCriteria: Array.isArray(result?.criteria),
        criteriaCount: result?.criteria?.length || 0,
        hasSummary: !!result?.summary,
        meta: result?.meta,
        version: result?.meta?.version || 'unknown',
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
      
      console.log(`🔍 ${UI_VERSION} - Processed insights:`, ins.map(i => ({
        id: i.id,
        criterionId: i.criterionId,
        hasSuggestion: !!i.suggestion,
        hasPrimary: !!i.suggestion_primary,
        hasSecondary: !!i.suggestion_secondary,
        suggestionLength: i.suggestion?.length || 0,
        primaryLength: i.suggestion_primary?.length || 0,
        secondaryLength: i.suggestion_secondary?.length || 0,
      })));
      
      setInsights(ins);
      setMeta(result?.meta);
      setCriteria(Array.isArray(result?.criteria) ? result.criteria : []);
      setSummary(result?.summary ?? null);
      storage.saveInsights(doc.id, ins);
      toast({ title: "הניתוח הושלם", description: "הודגשים והערות עודכנו" });
    } catch (e) {
      console.error(`❌ ${UI_VERSION} - Analysis failed:`, e);
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

  // Show loading state while document is being loaded
  if (!doc) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-gray-900 mb-2">טוען מסמך...</div>
          <div className="text-sm text-gray-500">ID: {id}</div>
        </div>
      </div>
    );
  }

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
            <Button onClick={onReanalyze} disabled={loading} variant="default" size="sm">
              {loading ? "מנתח..." : "ניתוח מחדש"}
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
            </div>

            {/* Word Count */}
            <div className="mb-4 text-sm text-gray-500">
              מספר תווים: {doc.content.length.toLocaleString()}
            </div>

            {/* Tabs for Canvas and Text Editor */}
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="canvas">תצוגת הדגשות</TabsTrigger>
                <TabsTrigger value="editor">עריכת טקסט</TabsTrigger>
              </TabsList>

              <TabsContent value="canvas" className="mt-4">
                <div className="bg-white rounded-lg border-2 border-blue-300 p-6">
                  <div ref={canvasRef} id="canvas-scroll" className="max-h-[70vh] overflow-y-auto">
                    <HighlightCanvas
                      content={doc.content}
                      insights={insights}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="editor" className="mt-4">
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
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto max-h-screen">
          <div className="p-6">
            <div className="space-y-6">
              {/* Version Info */}
              <div className="bg-blue-50 p-3 rounded border text-xs">
                <div className="font-semibold mb-2">🔧 Version Info:</div>
                <div>UI: {UI_VERSION}</div>
                <div>Backend: {meta?.version || 'unknown'}</div>
                <div>Source: {meta?.source || 'N/A'}</div>
              </div>

              {/* Enhanced Debug Panel */}
              <div className="bg-gray-50 p-3 rounded border text-xs">
                <div className="font-semibold mb-2">🐛 Debug Info:</div>
                <div>Insights: {insights.length}</div>
                <div>Criteria: {criteria.length}</div>
                <div>Summary: {summary ? '✓' : '✗'}</div>
                <div>Meta source: {meta?.source || 'N/A'}</div>
                <div>Meta version: {meta?.version || 'N/A'}</div>
                {insights[0] && (
                  <div className="mt-2 p-2 bg-white rounded border">
                    <div className="font-medium">Sample Insight:</div>
                    <div>ID: {insights[0].id}</div>
                    <div>suggestion: {insights[0].suggestion ? `✓ (${insights[0].suggestion.length} chars)` : '✗'}</div>
                    <div>suggestion_primary: {insights[0].suggestion_primary ? `✓ (${insights[0].suggestion_primary.length} chars)` : '✗'}</div>
                    <div>suggestion_secondary: {insights[0].suggestion_secondary ? `✓ (${insights[0].suggestion_secondary.length} chars)` : '✗'}</div>
                    {insights[0].suggestion_primary && (
                      <div className="mt-1 text-xs text-gray-600 max-h-16 overflow-y-auto">
                        <strong>Primary:</strong> {insights[0].suggestion_primary.substring(0, 100)}...
                      </div>
                    )}
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
            </div>
          </div>

          {/* Footer with version */}
          <div className="border-t border-gray-200 p-4 text-center text-xs text-gray-500">
            {UI_VERSION}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
