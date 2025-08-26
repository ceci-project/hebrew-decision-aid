import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/utils/fileReaders";
import { storage } from "@/services/storage";
import { analyzeDocument } from "@/services/analysis";
import { CRITERIA } from "@/data/criteria";
import type { DecisionDocument, Insight } from "@/types/models";
import type { AnalysisMeta } from "@/services/analysis";
import CriterionAccordion from "@/components/Editor/CriterionAccordion";
import DecisionEditor from "@/components/Editor/DecisionEditor";
import InsightDetailPanel from "@/components/Editor/InsightDetailPanel";
import FindingsPanel from "@/components/Editor/FindingsPanel";

const Index = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("מסמך חדש");
  const [content, setContent] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(undefined);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; weight: number; score: number; justification: string }>>([]);
  const [summary, setSummary] = useState<{ feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const navigate = useNavigate();

  const UI_VERSION = "App v2025-08-26-UI-4-Homepage";

  const handlePick = () => inputRef.current?.click();

  const createNewDocument = () => {
    // Enhanced validation and error handling
    if (!content.trim()) {
      toast({ title: "אין תוכן למסמך", description: "אנא הזינו טקסט לפני השמירה" });
      return;
    }

    console.log(`🚀 ${UI_VERSION} - Starting document creation...`);
    console.log(`📊 ${UI_VERSION} - Current state:`, {
      contentLength: content.length,
      title: title,
      insightsCount: insights.length,
      busy: busy,
      isCleared: isCleared
    });

    setBusy(true);
    try {
      // Check localStorage availability
      if (typeof Storage === "undefined") {
        throw new Error("LocalStorage לא זמין בדפדפן זה");
      }

      const now = new Date().toISOString();
      const doc: DecisionDocument = {
        id: String(Date.now()),
        title: title || "מסמך חדש",
        content,
        createdAt: now,
        updatedAt: now,
      };
      
      console.log(`🚀 ${UI_VERSION} - Creating document with ID: ${doc.id}`);
      storage.saveDocument(doc);
      
      // Save insights if any exist
      if (insights.length > 0) {
        storage.saveInsights(doc.id, insights);
        console.log(`💾 ${UI_VERSION} - Saved ${insights.length} insights for document ${doc.id}`);
      }
      
      toast({ title: "מסמך נוצר בהצלחה", description: "עובר לעמוד העורך..." });
      
      // Reset cleared state
      setIsCleared(false);
      
      // Navigate to editor page with slight delay to ensure save completes
      setTimeout(() => {
        console.log(`🧭 ${UI_VERSION} - Navigating to /editor/${doc.id}`);
        navigate(`/editor/${doc.id}`);
      }, 100);
      
    } catch (e) {
      console.error(`❌ ${UI_VERSION} - Error creating document:`, e);
      toast({ 
        title: "שגיאה ביצירת מסמך", 
        description: `פרטי השגיאה: ${String(e)}`,
        variant: "destructive"
      });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file?: File) => {
    console.log('📁 onFile called:', { hasFile: !!file, fileName: file?.name, fileSize: file?.size });
    if (!file) {
      console.log('❌ No file provided to onFile');
      return;
    }
    
    console.log('🚀 Starting file processing...');
    setBusy(true);
    try {
      console.log('📖 Extracting text from file...');
      const { title: extractedTitle, content: extractedContent } = await extractTextFromFile(file);
      console.log('✅ Text extracted:', { 
        titleLength: extractedTitle?.length || 0, 
        contentLength: extractedContent?.length || 0,
        title: extractedTitle?.substring(0, 50) + '...',
        contentPreview: extractedContent?.substring(0, 100) + '...'
      });
      
      setTitle(extractedTitle || "החלטת ממשלה חדשה");
      setContent(extractedContent);
      setIsCleared(false); // Reset cleared state when file is loaded
      console.log('📝 State updated with new content');
      toast({ title: "הקובץ נטען בהצלחה", description: "אפשר לערוך ולנתח עכשיו" });
    } catch (e) {
      console.error('❌ Error processing file:', e);
      toast({ title: "שגיאה בטעינת קובץ", description: String(e) });
    } finally {
      console.log('🏁 File processing completed, setting busy to false');
      setBusy(false);
    }
  };

  const onAnalyze = async () => {
    if (!content.trim()) {
      toast({ title: "אין טקסט לניתוח", description: "אנא הזינו טקסט" });
      return;
    }
    setLoading(true);
    try {
      console.log(`🚀 ${UI_VERSION} - Starting analysis`);
      console.log(`📊 ${UI_VERSION} - Content length:`, content.length);
      
      const result: any = await analyzeDocument(content);
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
      setShowAnalysis(true);
      toast({ title: "הניתוח הושלם", description: "תוצאות הניתוח מוצגות בצד" });
    } catch (e) {
      console.error(`❌ ${UI_VERSION} - Analysis failed:`, e);
      toast({ title: "שגיאה בניתוח", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleInsightClick = (insight: Insight) => {
    setSelectedInsight(insight);
    
    // Check if we have a saved document that matches this insight
    const savedDocuments = JSON.parse(localStorage.getItem('decisionDocuments') || '[]');
    
    // If we're not currently in the editor view and we have documents, navigate to editor
    if (!showAnalysis || !content.trim()) {
      // Find a document that might contain this insight
      if (savedDocuments.length > 0) {
        // For now, take the most recent document or try to find one that contains the quote
        let targetDocument = savedDocuments[savedDocuments.length - 1];
        
        // Try to find a document that contains the insight quote
        if (insight.quote) {
          const docWithQuote = savedDocuments.find((doc: any) => 
            doc.content && doc.content.includes(insight.quote)
          );
          if (docWithQuote) {
            targetDocument = docWithQuote;
          }
        }
        
        console.log(`🔍 ${UI_VERSION} - Navigating to editor with document:`, targetDocument.id);
        
        // Navigate to editor with the document and insight
        navigate(`/editor/${targetDocument.id}`, {
          state: { 
            selectedInsight: insight,
            scrollToInsight: true
          }
        });
        return;
      }
    }
    
    // If we're already in the editor or have content, scroll to the text
    if (showAnalysis && insight.rangeStart !== undefined && insight.rangeEnd !== undefined) {
      // Find the editor element
      const editorElement = document.querySelector('[contenteditable="true"]') as HTMLElement;
      if (editorElement) {
        // Create a temporary range to find the position
        const textContent = editorElement.textContent || '';
        if (insight.rangeStart < textContent.length) {
          // Use the DecisionEditor's built-in selection functionality
          setTimeout(() => {
            // Trigger a custom event to tell the editor to select this range
            const event = new CustomEvent('selectInsight', {
              detail: { 
                insight,
                rangeStart: insight.rangeStart,
                rangeEnd: insight.rangeEnd
              }
            });
            editorElement.dispatchEvent(event);
            
            // Scroll the editor into view
            editorElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }, 100);
        }
      }
    }
    
    console.log(`🔍 ${UI_VERSION} - Insight clicked:`, {
      id: insight.id,
      criterionId: insight.criterionId,
      quote: insight.quote?.substring(0, 50) + '...',
      rangeStart: insight.rangeStart,
      rangeEnd: insight.rangeEnd,
    });
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (isCleared && newContent.trim()) {
      setIsCleared(false); // Reset cleared state when content is added
    }
  };

  const handleInsightsChange = (newInsights: Insight[]) => {
    setInsights(newInsights);
  };

  const handleApplySuggestion = (suggestion: string) => {
    if (!selectedInsight) return;
    
    const beforeText = content.substring(0, selectedInsight.rangeStart);
    const afterText = content.substring(selectedInsight.rangeEnd);
    const newContent = beforeText + suggestion + afterText;
    
    setContent(newContent);
    toast({ title: "הצעה יושמה", description: "הטקסט עודכן בהצלחה" });
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">כלי ניתוח החלטות ממשלה</h1>
              <p className="text-sm text-gray-500">כתיבה וניתוח מסמכי החלטה</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button onClick={handlePick} disabled={busy} variant="outline" size="sm">
              {busy ? "טוען..." : "העלה קובץ"}
            </Button>
            <Button
              onClick={() => {
                console.log(`🧹 ${UI_VERSION} - Clearing all content and state`);
                setContent("");
                setTitle("מסמך חדש");
                setInsights([]);
                setSelectedInsight(null);
                setShowAnalysis(false);
                setCriteria([]);
                setSummary(null);
                setMeta(undefined);
                setIsCleared(true);
                setBusy(false); // Ensure busy state is reset
                setLoading(false); // Ensure loading state is reset
                console.log(`✅ ${UI_VERSION} - All states cleared successfully`);
                toast({ 
                  title: "הטקסט נוקה", 
                  description: "הקנבאס חזר למצב ריק - כעת תוכלו להזין תוכן חדש"
                });
              }}
              disabled={busy}
              variant="outline"
              size="sm"
            >
              נקה
            </Button>
            <Link to="/history">
              <Button variant="outline" size="sm">
                היסטוריה
              </Button>
            </Link>
            {isCleared ? (
              <Button 
                onClick={() => {
                  console.log('📁 Cleared state - opening file upload');
                  document.getElementById('file-upload')?.click();
                }}
                disabled={busy}
                variant="default" 
                size="sm"
              >
                העלה מסמך חדש
              </Button>
            ) : (
              <Button 
                onClick={createNewDocument} 
                disabled={busy || !content.trim()} 
                variant="default" 
                size="sm"
                title={!content.trim() ? "אנא הזינו תוכן למסמך לפני השמירה" : ""}
              >
                {busy ? "שומר..." : "שמור ועבור לעורך"}
              </Button>
            )}
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
                <h2 className="text-xl font-medium text-gray-900">הזנת מסמך</h2>
              </div>
              
              <div className={`mb-4 p-4 rounded-lg border ${
                isCleared 
                  ? "bg-green-50 border-green-200" 
                  : "bg-blue-50 border-blue-200"
              }`}>
                <div className={`text-sm ${isCleared ? "text-green-800" : "text-blue-800"}`}>
                  <strong>{isCleared ? "מוכן למסמך חדש" : "הוראות שימוש"}</strong>
                  <br />
                  {isCleared 
                    ? "הקנבאס נוקה והמערכת מוכנה לקלט חדש. כתבו או הדביקו טקסט, או העלו קובץ DOCX."
                    : "כתבו או הדביקו את טקסט ההחלטה, או העלו קובץ DOCX. לאחר מכן לחצו על \"נתח מסמך\" לקבלת הערות ודירוג."
                  }
                </div>
              </div>
            </div>

            {/* Word Count */}
            <div className="mb-4 text-sm text-gray-500">
              מספר תווים: {content.length.toLocaleString()}
            </div>

            {/* Main Text Editor */}
            <div className="bg-white rounded-lg border-2 border-blue-300 p-6">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="כותרת ההחלטה"
                className="mb-4 text-lg font-medium border-0 border-b border-gray-200 rounded-none px-0 focus:ring-0 focus:border-blue-500"
              />
              
              {showAnalysis ? (
                <DecisionEditor
                  content={content}
                  insights={insights}
                  onContentChange={handleContentChange}
                  onInsightsChange={handleInsightsChange}
                  onInsightSelect={handleInsightClick}
                  selectedInsight={selectedInsight}
                />
              ) : (
                <textarea
                  className="w-full min-h-[60vh] border-0 resize-none focus:ring-0 text-base leading-relaxed outline-none"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (isCleared && e.target.value.trim()) {
                      setIsCleared(false);
                    }
                  }}
                  placeholder={isCleared 
                    ? "הקנבאס נוקה - כתבו או הדביקו טקסט חדש כאן..."
                    : "כתבו או הדביקו את טקסט ההחלטה כאן..."
                  }
                />
              )}
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                <Button 
                  onClick={onAnalyze} 
                  disabled={loading || !content.trim()} 
                  className="w-full"
                >
                  {loading ? "מנתח..." : "נתח מסמך"}
                </Button>
              </div>
            </div>

            <input
              ref={inputRef}
              id="file-upload"
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || undefined)}
            />
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
                <div>Content Length: {content.length}</div>
                <div>Insights: {insights.length}</div>
                <div>Criteria: {criteria.length}</div>
                <div>Summary: {summary ? '✓' : '✗'}</div>
                <div>Busy: {busy ? '✓' : '✗'}</div>
                <div>Loading: {loading ? '✓' : '✗'}</div>
                <div>Cleared: {isCleared ? '✓' : '✗'}</div>
                <div>Can Save: {!busy && content.trim() ? '✓' : '✗'}</div>
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
                <div className="border-t border-gray-200 pt-6">
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

              {/* Analysis Results */}
              {showAnalysis && criteria.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <FindingsPanel 
                    criteriaData={criteria} 
                    insights={insights} 
                    onJump={handleInsightClick} 
                  />
                </div>
              )}

              {/* Quick Summary for when no detailed analysis */}
              {showAnalysis && insights.length === 0 && criteria.length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">ניתוח לפי קריטריונים</h3>
                  
                  <div className="space-y-3">
                    {CRITERIA.map((criterion) => {
                      const criterionData = criteria.find(c => c.id === criterion.id);
                      const score = criterionData?.score ?? 0;
                      const insightCount = insights.filter(ins => ins.criterionId === criterion.id).length;
                      
                      return (
                        <div key={criterion.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: `var(${criterion.colorVar})` }}
                            />
                            <span className="text-sm text-gray-700">{criterion.name}:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium text-gray-900">{insightCount}</span>
                            {score > 0 && (
                              <span className="text-xs text-gray-500">({score}/10)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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

          {/* Insight Detail Panel */}
          {selectedInsight && (
            <div className="border-t border-gray-200">
              <InsightDetailPanel
                insight={selectedInsight}
                onApplySuggestion={handleApplySuggestion}
                onClose={() => setSelectedInsight(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
