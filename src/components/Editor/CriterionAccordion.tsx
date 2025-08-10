import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Insight } from "@/types/models";
import { CRITERIA } from "@/data/criteria";
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
  onJump?: (ins: Insight) => void;
}

const SeverityBadge: React.FC<{ level?: Insight["severity"] }> = ({ level }) => {
  if (!level) return null;
  const label = level === 'critical' ? 'קריטי' : level === 'moderate' ? 'בינוני' : 'קל';
  const color = level === 'critical' ? 'bg-destructive text-destructive-foreground' : level === 'moderate' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${color}`}>{label}</span>;
};

const copy = async (text?: string) => {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); } catch {}
};

const CriterionAccordion: React.FC<Props> = ({ criteriaData, insights, onJump }) => {
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
                <div className="space-y-3 text-sm">
                  {data?.justification && (
                    <div>
                      <div className="font-medium">הסבר:</div>
                      <p className="text-muted-foreground leading-relaxed">{data.justification}</p>
                    </div>
                  )}

                  {critInsights.length > 0 ? (
                    <div>
                      <Separator className="my-2" />
                      <div className="flex items-center justify-between mb-1">
                        <div className="font-medium">ממצאים</div>
                        <span className="text-xs text-muted-foreground">{critInsights.length}</span>
                      </div>
                      <Accordion type="single" collapsible>
                        {critInsights.map((ins) => (
                          <AccordionItem key={`${c.id}-${ins.id}`} value={`${c.id}-${ins.id}`}>
                            <AccordionTrigger className="px-2">
                              <div className="flex w-full items-center justify-between gap-2 text-right">
                                <div className="truncate text-sm font-medium">"{ins.quote}"</div>
                                <div className="flex items-center gap-2">
                                  <SeverityBadge level={ins.severity} />
                                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onJump?.(ins); }}>מצא בטקסט</Button>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-2">
                              <div className="space-y-3">
                                {ins.explanation && (
                                  <div>
                                    <div className="text-xs font-semibold">בעיה</div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{ins.explanation}</p>
                                  </div>
                                )}
                                {ins.suggestion && (
                                  <div>
                                    <div className="flex items-center justify-between">
                                      <div className="text-xs font-semibold">הצעה עיקרית</div>
                                      <Button size="sm" variant="ghost" onClick={() => copy(ins.suggestion)}>העתק</Button>
                                    </div>
                                    <p className="text-sm leading-relaxed">{ins.suggestion}</p>
                                  </div>
                                )}
                                {Array.isArray(ins.alternatives) && ins.alternatives.length > 0 && (
                                  <div>
                                    <div className="text-xs font-semibold">חלופות</div>
                                    <ul className="list-disc pr-4 text-sm space-y-1">
                                      {ins.alternatives.map((alt, i) => (
                                        <li key={i} className="leading-relaxed">
                                          <div className="flex items-center justify-between gap-2">
                                            <span>{alt}</span>
                                            <Button size="sm" variant="ghost" onClick={() => copy(alt)}>העתק</Button>
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(ins.patchBalanced || ins.patchExtended) && (
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {ins.patchBalanced && (
                                      <div className="rounded-md border p-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="text-xs font-semibold">מוצע (מאוזן)</div>
                                          <Button size="sm" variant="ghost" onClick={() => copy(ins.patchBalanced)}>העתק</Button>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ins.patchBalanced}</p>
                                      </div>
                                    )}
                                    {ins.patchExtended && (
                                      <div className="rounded-md border p-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <div className="text-xs font-semibold">מוצע (מורחב)</div>
                                          <Button size="sm" variant="ghost" onClick={() => copy(ins.patchExtended)}>העתק</Button>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ins.patchExtended}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  ) : (
                    ev?.quote ? (
                      <div>
                        <div className="font-medium">ציטוט מהמסמך:</div>
                        <blockquote className="text-muted-foreground bg-secondary/50 rounded p-2">“{ev.quote}”</blockquote>
                      </div>
                    ) : null
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
