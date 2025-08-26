import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { storage } from "@/services/storage";
import { analyzeDocument } from "@/services/analysis";
import { CRITERIA, CRITERIA_MAP } from "@/data/criteria";
import { DecisionDocument, Insight } from "@/types/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { AnchorManager } from "@/services/anchorManager";
import DecisionEditor from "@/components/Editor/DecisionEditor";
import InsightDetailPanel from "@/components/Editor/InsightDetailPanel";
import CriterionAccordion from "@/components/Editor/CriterionAccordion";
import { Document, Packer, Paragraph } from "docx";
import type { AnalysisMeta } from "@/services/analysis";

const EditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [doc, setDoc] = useState<DecisionDocument | undefined>(undefined);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(undefined);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; weight: number; score: number; justification: string }>>([]);
  const [summary, setSummary] = useState<{ feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null>(null);

  const UI_VERSION = "App v2025-08-26-UI-7-OverlayEditor";

  // Load document on component mount
  useEffect(() => {
    console.log(`🚀 ${UI_VERSION} - Editor page loaded with ID: ${id}`);
    
    // Check for navigation state with insight to scroll to
    const navigationState = location.state as { selectedInsight?: Insight; scrollToInsight?: boolean } | null;
    if (navigationState?.selectedInsight) {
      console.log(`🎯 ${UI_VERSION} - Navigated with insight to highlight:`, navigationState.selectedInsight.id);
    }
    
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

    // Load and enhance insights from storage
    const loadedInsights = storage.getInsights(id);
    const enhancedInsights = loadedInsights.map(insight => 
      AnchorManager.enhanceInsightWithAnchors(insight, loadedDoc.content)
    );
    
    console.log(`🔍 ${UI_VERSION} - Loaded insights:`, enhancedInsights.length);
    setInsights(enhancedInsights);

    // If we have a specific insight to highlight from navigation, set it and trigger scroll
    if (navigationState?.scrollToInsight && navigationState?.selectedInsight) {
      setSelectedInsight(navigationState.selectedInsight);
      
      // Trigger scroll after editor is rendered
      setTimeout(() => {
        const insight = navigationState.selectedInsight;
        if (insight) {
          console.log(`🎯 ${UI_VERSION} - Auto-scrolling to insight:`, insight.id);
          window.dispatchEvent(new CustomEvent('selectInsight', {
            detail: { insight }
          }));
        }
      }, 1000); // Give more time for editor to render
    }

  }, [id, navigate, location.state]);

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
        version: result?.meta?.version || 'unknown'
      });
      
      const rawInsights: Insight[] = Array.isArray(result)
        ? (result as Insight[])
        : (result?.insights ?? []);
      
      // Enhance insights with stable anchors
      const enhancedInsights = rawInsights.map(insight => 
        AnchorManager.enhanceInsightWithAnchors(insight, doc.content)
      );
      
      console.log(`🔍 ${UI_VERSION} - Processed insights:`, enhancedInsights.length);
      
      setInsights(enhancedInsights);
      setMeta(result?.meta);
      setCriteria(Array.isArray(result?.criteria) ? result.criteria : []);
      setSummary(result?.summary ?? null);
      storage.saveInsights(doc.id, enhancedInsights);
      toast({ title: "הניתוח הושלם", description: "הודגשים והערות עודכנו" });
    } catch (e) {
      console.error(`❌ ${UI_VERSION} - Analysis failed:`, e);
      toast({ title: "שגיאה בניתוח", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleContentChange = (newContent: string) => {
    if (!doc) return;
    
    const updated = { ...doc, content: newContent, updatedAt: new Date().toISOString() };
    setDoc(updated);
    storage.saveDocument(updated);
  };

  const handleInsightsChange = (newInsights: Insight[]) => {
    setInsights(newInsights);
    if (doc) {
      storage.saveInsights(doc.id, newInsights);
    }
  };

  const handleApplySuggestion = (suggestion: string) => {
    if (!selectedInsight || !doc) return;
    
    const start = selectedInsight.rangeStart;
    const end = selectedInsight.rangeEnd;
    const newContent = doc.content.slice(0, start) + suggestion + doc.content.slice(end);
    
    // Update document
    const updated = { ...doc, content: newContent, updatedAt: new Date().toISOString() };
    setDoc(updated);
    storage.saveDocument(updated);
    
    // Update insights positions
    const updatedInsights = AnchorManager.updateInsightsAfterEdit(
      insights,
      start,
      end,
      suggestion,
      newContent
    );
    
    // Mark the current insight as applied
    const finalInsights = updatedInsights.map(insight => 
      insight.id === selectedInsight.id 
        ? { ...insight, isStale: true } // Mark as applied/stale
        : insight
    );
    
    setInsights(finalInsights);
    storage.saveInsights(doc.id, finalInsights);
    setSelectedInsight(null);
    
    toast({ title: "הצעה יושמה", description: "הטקסט עודכן בהתאם" });
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

  const stalePercentage = AnchorManager.getStalePercentage(insights);

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
            {stalePercentage > 10 && (
              <Button onClick={onReanalyze} variant="outline" size="sm" className="text-yellow-600 border-yellow-600">
                עדכן הדגשות ({stalePercentage.toFixed(0)}% לא עדכני)
              </Button>
            )}
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
            </div>

            {/* Word Count and Stats */}
            <div className="mb-4 flex items-center gap-4 text-sm text-gray-500">
              <span>מספר תווים: {doc.content.length.toLocaleString()}</span>
              <span>הדגשות: {insights.filter(i => !i.isStale).length}</span>
              {stalePercentage > 0 && (
                <span className="text-yellow-600">
                  {insights.filter(i => i.isStale).length} דורשות עדכון
                </span>
              )}
            </div>

            {/* Overlay Editor */}
            <DecisionEditor
              content={doc.content}
              insights={insights}
              onContentChange={handleContentChange}
              onInsightsChange={handleInsightsChange}
              onInsightSelect={setSelectedInsight}
              selectedInsight={selectedInsight}
            />

            {/* Keyboard shortcuts help */}
            <div className="mt-4 text-xs text-gray-500">
              <strong>קיצורי מקלדת:</strong> Alt+↑/↓ למעבר בין הדגשות | Ctrl+Enter ליישום הצעה נבחרת
            </div>
          </div>
        </div>

        {/* Right Sidebar - Split Layout */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col max-h-screen">
          {/* Sticky Insight Detail Panel */}
          {selectedInsight && (
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <InsightDetailPanel
                insight={selectedInsight}
                onApplySuggestion={handleApplySuggestion}
                onClose={() => setSelectedInsight(null)}
              />
            </div>
          )}
          
          {/* Scrollable Analysis Panel */}
          <div className="flex-1 overflow-y-auto">
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
                  <div>Active: {insights.filter(i => !i.isStale).length}</div>
                  <div>Stale: {insights.filter(i => i.isStale).length}</div>
                  <div>Criteria: {criteria.length}</div>
                  <div>Summary: {summary ? '✓' : '✗'}</div>
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

                {/* Quick Overview */}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">סקירה מהירה:</h4>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div>לחץ על הדגשה בטקסט לפרטים</div>
                    <div>השתמש ב-Alt+↑/↓ לניווט</div>
                    <div>החלף הצעות ישירות מהפאנל</div>
                  </div>
                </div>

                {/* Detailed Criterion Analysis */}
                <div className="border-t border-gray-200 pt-6">
                  <CriterionAccordion 
                    criteriaData={criteria} 
                    insights={insights.filter(i => !i.isStale)} 
                    onJump={(insight) => {
                      setSelectedInsight(insight);
                       // Scroll to insight in text - use the correct event name
                       const editorRef = document.querySelector('[contenteditable="true"]') as HTMLElement;
                       if (editorRef) {
                         editorRef.dispatchEvent(new CustomEvent('selectInsight', { 
                           detail: { insight } 
                         }));
                       }
                    }} 
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
    </div>
  );
};

export default EditorPage;
