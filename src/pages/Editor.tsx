import { useEffect, useMemo, useState } from "react";
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
      const result: any = await analyzeDocument(doc.content);
      const ins: Insight[] = Array.isArray(result)
        ? (result as Insight[])
        : (result?.insights ?? []);
      setInsights(ins);
      setMeta(result?.meta);
      setCriteria(Array.isArray(result?.criteria) ? result.criteria : []);
      setSummary(result?.summary ?? null);
      storage.saveInsights(doc.id, ins);
      toast({ title: "הניתוח הושלם", description: "הודגשים והערות עודכנו" });
    } catch (e) {
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
    // Ensure canvas is visible before scrolling
    setTab("canvas");
    requestAnimationFrame(() => {
      const el =
        document.getElementById(`hl-${ins.criterionId}-${ins.id}`) ||
        document.getElementById(`hl-${ins.id}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      // Temporary visual focus
      el.classList.add("ring-2", "ring-primary/50", "transition-shadow");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50", "transition-shadow"), 1200);
    });
  };
  const short = (s?: string | null) => (s ? `${s.slice(0,6)}…${s.slice(-4)}` : "");


  if (!doc) return null;

  return (
    <div dir="rtl" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-4 space-y-4">
        <div className="flex items-center gap-2">
          <Input
            value={doc.title}
            onChange={(e) => {
              const updated = { ...doc, title: e.target.value, updatedAt: new Date().toISOString() };
              setDoc(updated);
              storage.saveDocument(updated);
            }}
            placeholder="כותרת המסמך"
          />
          <Button onClick={onReanalyze} disabled={loading} variant="default">
            {loading ? "מנתח..." : "נתח מחדש"}
          </Button>
          <Button onClick={onExportDocx} variant="secondary">ייצוא DOCX</Button>
        </div>

        <div className="rounded-lg border p-3 max-h-[65vh] overflow-auto">
          {meta && (
            <div className="mb-2 text-[11px] text-muted-foreground">
              {meta.source === 'assistants' ? (
                <span>
                  מופעל ע״י OpenAI Assistant
                  {meta.assistantId ? ` • ${short(meta.assistantId)}` : ''}
                  {meta.runId ? ` • ריצה ${short(meta.runId)}` : ''}
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
          )}
          {summary && (
            <div className="mb-3 rounded-md border p-3 bg-secondary/30">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">ציון ישימות משוקלל</span>
                <span className="font-medium">
                  {summary.feasibilityPercent}% • {summary.feasibilityLevel === 'low' ? 'ישימות נמוכה' : summary.feasibilityLevel === 'medium' ? 'ישימות בינונית' : 'ישימות גבוהה'}
                </span>
              </div>
              <div className="mt-2">
                <Progress value={summary.feasibilityPercent} />
              </div>
              {summary.reasoning && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{summary.reasoning}</p>
              )}
            </div>
          )}
          {criteria.length > 0 ? (
            <div className="mb-3">
              <CriterionAccordion criteriaData={criteria} insights={insights} onJump={scrollToInsight} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">אין קריטריונים להצגה</p>
          )}

        </div>
      </section>

      <section className="lg:col-span-8">
        <Tabs value={tab} onValueChange={setTab} dir="rtl">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="canvas">מצב קנבס</TabsTrigger>
            <TabsTrigger value="edit">מצב עריכה</TabsTrigger>
          </TabsList>
          <TabsContent value="canvas" className="mt-4">
            <div className="rounded-lg border p-5 max-h-[75vh] overflow-auto bg-card">
              <HighlightCanvas content={doc.content} insights={insights} />
            </div>
          </TabsContent>
          <TabsContent value="edit" className="mt-4">
            <Textarea
              className="min-h-[70vh]"
              value={doc.content}
              onChange={(e) => {
                const updated = { ...doc, content: e.target.value, updatedAt: new Date().toISOString() };
                setDoc(updated);
                storage.saveDocument(updated);
              }}
              placeholder="כתבו או ערכו את טקסט ההחלטה כאן..."
            />
          </TabsContent>
        </Tabs>
      </section>
    </div>
  );
};

export default EditorPage;
