import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Insight } from "@/types/models";
import { CRITERIA, CRITERIA_MAP } from "@/data/criteria";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

type CriterionScore = {
  id: string;
  name: string;
  weight: number; // percent
  score: number; // 0-5
  justification: string;
  evidence?: Array<{ quote: string; rangeStart: number; rangeEnd: number }>;
};

interface Props {
  criteriaData: CriterionScore[];
  insights: Insight[];
}

const CriterionAccordion: React.FC<Props> = ({ criteriaData, insights }) => {
  const byId: Record<string, CriterionScore> = Object.fromEntries(
    (criteriaData || []).map((c) => [c.id, c])
  );

  const insightsByCrit: Record<string, Insight[]> = {};
  for (const ins of insights) {
    (insightsByCrit[ins.criterionId] ||= []).push(ins);
  }

  const statusIcon = (score: number | undefined) => {
    if (typeof score !== "number") return null;
    if (score >= 4) return <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />;
    if (score >= 2) return <AlertCircle className="h-4 w-4 text-muted-foreground" aria-hidden />;
    return <XCircle className="h-4 w-4 text-destructive" aria-hidden />;
  };

  const scoreBadge = (score: number | undefined) => (
    <Badge variant="secondary" className="rounded px-2 py-1 text-xs">
      {typeof score === "number" ? `${score}/5` : "—"}
    </Badge>
  );

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold mb-1">ציונים לפי קריטריונים</h4>
      <Accordion type="multiple" className="w-full">
        {CRITERIA.map((c) => {
          const data = byId[c.id];
          const ev = data?.evidence?.[0];
          const critInsights = insightsByCrit[c.id] || [];
          return (
            <AccordionItem key={c.id} value={c.id} className="border rounded-md px-2">
              <AccordionTrigger className="flex items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-3 w-3 rounded" style={{ background: `hsl(var(${c.colorVar}))` }} />
                  <span className="text-sm font-medium">{c.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">משקל: {typeof data?.weight === 'number' ? `${data.weight}%` : '—'}</span>
                  {scoreBadge(data?.score)}
                  {statusIcon(data?.score)}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-2 text-sm">
                  {data?.justification && (
                    <div>
                      <div className="font-medium">הסבר:</div>
                      <p className="text-muted-foreground leading-relaxed">{data.justification}</p>
                    </div>
                  )}
                  {ev?.quote && (
                    <div>
                      <div className="font-medium">ציטוט מהמסמך:</div>
                      <blockquote className="text-muted-foreground bg-secondary/50 rounded p-2">“{ev.quote}”</blockquote>
                    </div>
                  )}
                  {critInsights.length > 0 && (
                    <div>
                      <Separator className="my-1" />
                      <div className="font-medium mb-1">הצעות לשיפור:</div>
                      <ul className="list-disc pr-5 space-y-1">
                        {critInsights.map((ins) => (
                          <li key={ins.id} className="text-xs text-muted-foreground">{ins.suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default CriterionAccordion;
