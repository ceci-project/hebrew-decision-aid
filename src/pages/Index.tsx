import { useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { extractTextFromFile } from "@/utils/fileReaders";
import { storage } from "@/services/storage";
import { analyzeDocument } from "@/services/analysis";
import { CRITERIA } from "@/data/criteria";
import type { DecisionDocument, Insight } from "@/types/models";
import type { AnalysisMeta } from "@/services/analysis";

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
  const navigate = useNavigate();

  const handlePick = () => inputRef.current?.click();

  const createNewDocument = () => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const doc: DecisionDocument = {
        id: String(Date.now()),
        title: title || "מסמך חדש",
        content,
        createdAt: now,
        updatedAt: now,
      };
      storage.saveDocument(doc);
      toast({ title: "מסמך נוצר בהצלחה", description: "המסמך נשמר במערכת" });
      // Reset form
      setTitle("מסמך חדש");
      setContent("");
      setInsights([]);
      setCriteria([]);
      setSummary(null);
      setMeta(undefined);
    } catch (e) {
      toast({ title: "שגיאה ביצירת מסמך", description: String(e) });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const { title: extractedTitle, content: extractedContent } = await extractTextFromFile(file);
      setTitle(extractedTitle || "החלטת ממשלה חדשה");
      setContent(extractedContent);
      toast({ title: "הקובץ נטען בהצלחה", description: "אפשר לערוך ולנתח עכשיו" });
    } catch (e) {
      toast({ title: "שגיאה בטעינת קובץ", description: String(e) });
    } finally {
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
      const result: any = await analyzeDocument(content);
      const ins: Insight[] = Array.isArray(result)
        ? (result as Insight[])
        : (result?.insights ?? []);
      setInsights(ins);
      setMeta(result?.meta);
      setCriteria(Array.isArray(result?.criteria) ? result.criteria : []);
      setSummary(result?.summary ?? null);
      toast({ title: "הניתוח הושלם", description: "תוצאות הניתוח מוצגות בצד" });
    } catch (e) {
      toast({ title: "שגיאה בניתוח", description: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const short = (s?: string | null) => (s ? `${s.slice(0,6)}…${s.slice(-4)}` : "");

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
            <Link to="/history">
              <Button variant="outline" size="sm">
                היסטוריה
              </Button>
            </Link>
            <Button 
              onClick={createNewDocument} 
              disabled={busy || !content.trim()} 
              variant="default" 
              size="sm"
            >
              שמור מסמך
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
                <h2 className="text-xl font-medium text-gray-900">הזנת מסמך</h2>
              </div>
              
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <strong>הוראות שימוש</strong>
                  <br />
                  כתבו או הדביקו את טקסט ההחלטה, או העלו קובץ DOCX. לאחר מכן לחצו על "נתח מסמך" לקבלת הערות ודירוג.
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
              
              <Textarea
                className="min-h-[60vh] border-0 resize-none focus:ring-0 text-base leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="כתבו או הדביקו את טקסט ההחלטה כאן..."
              />
              
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
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || undefined)}
            />
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 bg-gray-50 border-l border-gray-200 p-6">
          <div className="space-y-6">
            {/* Quick Summary */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">סיכום מהיר</h3>
              
              {criteria.length > 0 ? (
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
              ) : (
                <p className="text-sm text-gray-500">אין נתונים להצגה - הריצו ניתוח</p>
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
  );
};

export default Index;
