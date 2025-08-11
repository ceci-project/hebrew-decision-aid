import React from "react";
import { Insight } from "@/types/models";
import { CRITERIA, CRITERIA_MAP } from "@/data/criteria";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

interface Props {
  insights: Insight[];
  onJump?: (ins: Insight) => void;
}

const SeverityBadge: React.FC<{ level?: Insight["severity"] }> = ({ level }) => {
  if (!level) return null;
  const label = level === 'critical' ? 'קריטי' : level === 'moderate' ? 'בינוני' : 'קל';
  const color = level === 'critical' ? 'bg-destructive text-destructive-foreground' : level === 'moderate' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
  return <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] ${color}`}>{label}</span>;
};

const FindingsAccordion: React.FC<Props> = ({ insights, onJump }) => {
  const grouped: Record<string, Insight[]> = React.useMemo(() => {
    const m: Record<string, Insight[]> = {};
    for (const c of CRITERIA) m[c.id] = [];
    for (const ins of insights) (m[ins.criterionId] ||= []).push(ins);
    return m;
  }, [insights]);

  const copy = async (text?: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  return (
    <div className="space-y-4">
      {CRITERIA.map((c) => {
        const list = grouped[c.id] || [];
        if (!list.length) return null;
        return (
          <section key={c.id} className="rounded-md border">
            <header className="flex items-center justify-between p-3">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block h-3 w-3 rounded" style={{ background: `hsl(var(${c.colorVar}))` }} />
                <h4 className="text-sm font-semibold">{c.name}</h4>
              </div>
              <span className="text-xs text-muted-foreground">{list.length} ממצאים</span>
            </header>
            <div className="border-t">
              <Accordion type="single" collapsible>
                {list.map((ins) => (
                  <AccordionItem key={`${c.id}-${ins.id}`} value={`${c.id}-${ins.id}`}>
                    <AccordionTrigger className="px-3">
                      <div className="flex w-full items-center justify-between gap-2 text-right">
                        <div
                          className="truncate text-sm font-medium cursor-pointer hover:underline"
                          title={ins.quote}
                          role="button"
                          tabIndex={0}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onJump?.(ins); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onJump?.(ins); } }}
                        >
                          "{ins.quote}"
                        </div>
                        <div className="flex items-center gap-2">
                          <SeverityBadge level={ins.severity} />
                          <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onJump?.(ins); }}>מצא בטקסט</Button>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3">
                      <div className="space-y-3">
                        {ins.explanation && (
                          <div>
                            <div className="text-xs font-semibold">אתגר</div>
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
          </section>
        );
      })}
    </div>
  );
};

export default FindingsAccordion;