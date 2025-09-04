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
import VersionInfo from "@/components/VersionInfo";
import FloatingActionBox from "@/components/ui/floating-action-box";
import { FloatingInsightDetail } from "@/components/ui/floating-insight-detail";
import { Download } from "lucide-react";
import { env } from "@/config/environment";

const Index = () => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentCriterion, setCurrentCriterion] = useState<string>("");
  const [title, setTitle] = useState("מסמך חדש");
  const [content, setContent] = useState("");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [meta, setMeta] = useState<AnalysisMeta | undefined>(undefined);
  const [criteria, setCriteria] = useState<Array<{ id: string; name: string; weight: number; score: number; justification: string }>>([]);
  const [summary, setSummary] = useState<{ feasibilityPercent: number; feasibilityLevel: 'low' | 'medium' | 'high'; reasoning: string } | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [floatingInsight, setFloatingInsight] = useState<Insight | null>(null);
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
      
      toast({ title: "מסמך נשמר בהצלחה" });
      
      // Reset cleared state
      setIsCleared(false);
      
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

  const exportToDocx = () => {
    if (!content.trim()) {
      toast({ title: "אין תוכן לייצא", description: "אנא הזינו טקסט לפני הייצוא" });
      return;
    }
    
    // Create a simple HTML content for DOCX export
    const htmlContent = `
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title || "מסמך"}</title>
        </head>
        <body>
          <h1>${title || "מסמך"}</h1>
          <div>${content.replace(/\n/g, '<br>')}</div>
        </body>
      </html>
    `;
    
    const blob = new Blob([htmlContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'מסמך'}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({ title: "הקובץ יוצא בהצלחה" });
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
    setAnalysisProgress(0);
    setCurrentCriterion("");
    
    try {
      console.log(`🚀 ${UI_VERSION} - Starting analysis`);
      console.log(`📊 ${UI_VERSION} - Content length:`, content.length);
      
      // Simulate progress through criteria
      const criteriaNames = Object.values(CRITERIA).map(c => c.name);
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => {
          const newProgress = Math.min(prev + 15, 90);
          const criterionIndex = Math.floor((newProgress / 90) * criteriaNames.length);
          setCurrentCriterion(criteriaNames[criterionIndex] || "מסיים ניתוח...");
          return newProgress;
        });
      }, 800);
      
      const result: any = await analyzeDocument(content);
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      setCurrentCriterion("הניתוח הושלם");
      
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
      
      setTimeout(() => {
        setAnalysisProgress(0);
        setCurrentCriterion("");
      }, 2000);
      
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
    
    // Show floating insight detail
    setFloatingInsight(insight);
    
    // Keep existing functionality for text scrolling when in analysis view
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
            
            // Find the highlighted element to scroll to it precisely
            setTimeout(() => {
              const highlightedElement = document.querySelector('.insight-highlight.ring-2') as HTMLElement;
              if (highlightedElement) {
                const rect = highlightedElement.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                
                // Get the insight panel element to calculate its position
                const insightPanel = document.querySelector('[role="region"][aria-label="Insight details"]') || 
                                    document.querySelector('.insight-detail-panel') ||
                                    document.querySelector('[class*="InsightDetailPanel"]');
                
                if (insightPanel) {
                  // Get the panel's position relative to viewport
                  const panelRect = insightPanel.getBoundingClientRect();
                  
                  // Calculate scroll position to align highlighted text with insight panel
                  // We want the highlighted text to appear at the same Y position as the panel content
                  const panelContentTop = panelRect.top + 100; // Account for panel header
                  const currentTextTop = rect.top;
                  const scrollOffset = currentTextTop - panelContentTop;
                  
                  window.scrollTo({
                    top: window.scrollY + scrollOffset,
                    behavior: 'smooth'
                  });
                } else {
                  // Fallback: position at a fixed location if panel not found
                  // Keep text in the middle-left of the viewport (since panel is on the right)
                  const targetPosition = window.scrollY + rect.top - (viewportHeight * 0.4);
                  
                  window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                  });
                }
              } else {
                // Fallback to editor scrolling if highlight not found
                editorElement.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'center' 
                });
              }
            }, 150); // Give time for the highlight to be applied
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
            <Button 
              onClick={() => {
                // Navigate to CECI chat interface at the new unified path
                window.location.href = '/ceci-ai-chat';
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              size="sm"
            >
              מעבר לצ'אט
            </Button>
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
                // Reset file input to allow re-uploading the same file
                if (inputRef.current) {
                  inputRef.current.value = '';
                  console.log(`🔄 ${UI_VERSION} - File input reset`);
                }
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
            {isCleared ? (
              <Button 
                onClick={() => {
                  console.log('📁 Cleared state - opening file upload');
                  handlePick();
                }}
                disabled={busy}
                variant="default" 
                size="sm"
              >
                העלה מסמך חדש
              </Button>
            ) : (
              <>
                <Button 
                  onClick={createNewDocument} 
                  disabled={busy || !content.trim()} 
                  variant="default" 
                  size="sm"
                  title={!content.trim() ? "אנא הזינו תוכן למסמך לפני השמירה" : ""}
                >
                  {busy ? "שומר..." : "שמור"}
                </Button>
                {content.trim() && (
                  <Button 
                    onClick={exportToDocx}
                    disabled={busy}
                    variant="outline" 
                    size="sm"
                  >
                    <Download className="w-4 h-4 ml-2" />
                    יצא ל-DOCX
                  </Button>
                )}
              </>
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
              
              <DecisionEditor
                content={content}
                insights={insights}
                onContentChange={handleContentChange}
                onInsightsChange={handleInsightsChange}
                onInsightSelect={handleInsightClick}
                selectedInsight={selectedInsight}
                criteria={criteria}
              />
              
              <div className="mt-4 pt-4 border-t border-gray-200">
                {loading && (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>מתקדם בניתוח...</span>
                      <span>{analysisProgress}%</span>
                    </div>
                    <Progress value={analysisProgress} className="h-2" />
                    {currentCriterion && (
                      <div className="text-xs text-gray-500">
                        {currentCriterion}
                      </div>
                    )}
                  </div>
                )}
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

        {/* Enhanced Sidebar */}
        {(showAnalysis || insights.length > 0) && (
          <div className="w-96 border-l border-gray-200 bg-white">
            <div className="p-6 h-full overflow-auto">
              {selectedInsight ? (
                <InsightDetailPanel
                  insight={selectedInsight}
                  onClose={() => setSelectedInsight(null)}
                />
              ) : (
                <div className="space-y-6">
                  {/* Quick Stats */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-3">סטטיסטיקות</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600">סך הדגשות:</div>
                        <div className="font-semibold text-lg">{insights.length}</div>
                      </div>
                      <div>
                        <div className="text-gray-600">הדגשות פעילות:</div>
                        <div className="font-semibold text-lg text-green-600">
                          {insights.filter(i => !i.isStale).length}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">הדגשות ישנות:</div>
                        <div className="font-semibold text-lg text-orange-600">
                          {insights.filter(i => i.isStale).length}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600">תווים:</div>
                        <div className="font-semibold text-lg">{content.length.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Feasibility Summary */}
                  {summary && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">הערכת ביצוע</h3>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-gray-600">רמת הביצוע:</span>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            summary.feasibilityLevel === 'high' ? 'bg-green-100 text-green-800' :
                            summary.feasibilityLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {summary.feasibilityLevel === 'high' ? 'גבוהה' :
                             summary.feasibilityLevel === 'medium' ? 'בינונית' : 'נמוכה'}
                          </span>
                          <span className="font-bold text-lg">{summary.feasibilityPercent}%</span>
                        </div>
                      </div>
                      <Progress value={summary.feasibilityPercent} className="mb-3" />
                      <p className="text-sm text-gray-700 leading-relaxed">{summary.reasoning}</p>
                    </div>
                  )}
                  
                  {/* Keyboard Shortcuts */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">קיצורי מקלדת</h4>
                    <div className="text-xs text-gray-600 space-y-1">
                      <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">Alt + ↑/↓</kbd> - ניווט בין הדגשות</div>
                      <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl + Z</kbd> - ביטול</div>
                      <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl + Y</kbd> - חזרה</div>
                      <div><kbd className="px-1 py-0.5 bg-gray-200 rounded">Ctrl + Enter</kbd> - יישום הצעה</div>
                    </div>
                  </div>
                  
                  {/* Detailed Analysis */}
                  <FindingsPanel 
                    insights={insights} 
                    criteriaData={criteria}
                    onJump={handleInsightClick}
                  />
                  
                  {/* Version & Debug Info */}
                  <div className="space-y-4">
                    <VersionInfo />
                    {meta && (
                      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg space-y-1">
                        <div className="font-medium text-gray-700 mb-2">פרטי ניתוח</div>
                        <div>גרסת UI: {UI_VERSION}</div>
                        <div>מקור: {meta.source || 'לא ידוע'}</div>
                        <div>גרסת ניתוח: {meta.version || 'לא ידוע'}</div>
                        
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Floating Action Box */}
      <FloatingActionBox
        onAnalyze={onAnalyze}
        onFileUpload={handlePick}
        busy={loading || busy}
        disabled={!content.trim()}
      />
      
      {/* Floating Insight Detail */}
      {floatingInsight && (
        <FloatingInsightDetail
          insight={floatingInsight}
          criteria={criteria}
          onClose={() => setFloatingInsight(null)}
        />
      )}
    </div>
  );
};

export default Index;
