
import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Insight } from "@/types/models";
import { CRITERIA } from "@/data/criteria";
import { CheckCircle2, AlertCircle, XCircle, ArrowRight, Copy, MapPin } from "lucide-react";

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

const CriterionAccordion: React.FC<Props> = ({ criteriaData, insights, onJump }) => {
  console.log('🔍 CriterionAccordion received data:', {
    criteriaDataCount: criteriaData?.length || 0,
    insightsCount: insights?.length || 0,
    sampleInsight: insights?.[0] ? {
      id: insights[0].id,
      suggestion: insights[0].suggestion,
      suggestion_primary: insights[0].suggestion_primary,
      suggestion_secondary: insights[0].suggestion_secondary,
      hasNewFields: !!(insights[0].suggestion_primary || insights[0].suggestion_secondary)
    } : null
  });

  const byId: Record<string, CriterionScore> = Object.fromEntries(
    (criteriaData || []).map((c) => [c.id, c])
  );

  const insightsByCrit: Record<string, Insight[]> = {};
  for (const ins of insights) {
    (insightsByCrit[ins.criterionId] ||= []).push(ins);
  }

  const statusIcon = (score: number | undefined) => {
    if (typeof score !== "number") return null;
    if (score >= 4) return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
    if (score >= 2) return <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden />;
    return <XCircle className="h-4 w-4 text-red-500" aria-hidden />;
  };

  const scoreBadge = (score: number | undefined, weight: number | undefined) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">
        משקל: {typeof weight === 'number' ? `${weight}%` : '—'}
      </span>
      <Badge variant="outline" className="text-sm font-medium">
        {typeof score === "number" ? `${score}/5` : "—"}
      </Badge>
    </div>
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('📋 Copied to clipboard:', text.substring(0, 50) + '...');
    } catch (error) {
      console.error('❌ Copy failed:', error);
    }
  };

  return (
    <div className="space-y-2">
      <Accordion type="multiple" className="w-full space-y-2">
        {CRITERIA.map((c) => {
          const data = byId[c.id];
          const critInsights = insightsByCrit[c.id] || [];
          const mainInsight = critInsights[0]; // Take the first insight as the main one
          
          console.log(`🎯 Rendering criterion ${c.id}:`, {
            hasMainInsight: !!mainInsight,
            suggestion_primary: mainInsight?.suggestion_primary,
            suggestion_secondary: mainInsight?.suggestion_secondary,
            basicSuggestion: mainInsight?.suggestion
          });
          
          return (
            <AccordionItem key={c.id} value={c.id} className="border rounded-lg px-3 py-1">
              <AccordionTrigger className="flex items-center justify-between gap-3 py-3 hover:no-underline">
                <div className="flex items-center gap-3">
                  <span 
                    aria-hidden 
                    className="inline-block h-4 w-4 rounded" 
                    style={{ background: `hsl(var(${c.colorVar}))` }} 
                  />
                  <span className="text-base font-medium text-right">{c.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {scoreBadge(data?.score, data?.weight)}
                  {statusIcon(data?.score)}
                </div>
              </AccordionTrigger>
              
              <AccordionContent className="pb-4">
                <div className="space-y-4">
                  {/* הסבר ותובנה כללית */}
                  {(mainInsight?.explanation || data?.justification) && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">הסבר ותובנה כללית</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {mainInsight?.explanation || data?.justification}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* ציטוטים מהמסמך */}
                  {(mainInsight?.quotes && mainInsight.quotes.length > 0) ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">
                          {mainInsight.quotes.length > 1 
                            ? `ציטוטים מהמסמך (${mainInsight.quotes.length})`
                            : 'ציטוט מהמסמך'}
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {mainInsight.quotes.map((quote, qIdx) => (
                          <div key={quote.id || qIdx} className="relative">
                            {mainInsight.quotes.length > 1 && (
                              <div className="text-xs text-muted-foreground mb-1">
                                ציטוט {qIdx + 1}:
                              </div>
                            )}
                            <blockquote className="bg-secondary/50 rounded-md p-3 border-r-4 border-primary/30 group hover:bg-secondary/70 transition-colors">
                              <p className="text-sm italic">"{quote.text}"</p>
                              {onJump && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => {
                                    // Navigate to specific quote without closing accordion
                                    const quoteElement = document.querySelector(`[data-quote-ids*="${quote.id}"]`);
                                    if (quoteElement) {
                                      quoteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      // Add pulse animation
                                      quoteElement.classList.add('highlight-pulse');
                                      setTimeout(() => {
                                        quoteElement.classList.remove('highlight-pulse');
                                      }, 4500);
                                      
                                      // Trigger click on the highlight to show InsightPanel
                                      const clickEvent = new MouseEvent('click', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                      });
                                      quoteElement.dispatchEvent(clickEvent);
                                    }
                                    // Don't call onJump to keep accordion open
                                  }}
                                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MapPin className="h-3 w-3 mr-1" />
                                  מעבר לציטוט
                                </Button>
                              )}
                            </blockquote>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : mainInsight?.quote ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">ציטוט מהמסמך</h4>
                        {onJump && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              // Find and scroll to the quote
                              const quoteElements = document.querySelectorAll(`[data-criterion-ids*="${mainInsight.criterionId}"]`);
                              if (quoteElements.length > 0) {
                                quoteElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // Trigger click to show InsightPanel
                                const clickEvent = new MouseEvent('click', {
                                  bubbles: true,
                                  cancelable: true,
                                  view: window
                                });
                                quoteElements[0].dispatchEvent(clickEvent);
                              }
                            }}
                            className="text-xs"
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            מצא בטקסט
                          </Button>
                        )}
                      </div>
                      <blockquote className="bg-secondary/50 rounded-md p-3 border-r-4 border-primary/30">
                        <p className="text-sm italic">"{mainInsight.quote}"</p>
                      </blockquote>
                    </div>
                  ) : null}

                  <Separator />

                  {/* אתגר */}
                  {mainInsight?.explanation && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-300">
                        אתגר זוהה
                      </h4>
                      <p className="text-sm leading-relaxed">
                        {mainInsight.explanation}
                      </p>
                    </div>
                  )}

                  <Separator />

                  {/* הצעות לשיפור */}
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-emerald-700 dark:text-emerald-300">
                      הצעות לשיפור
                    </h4>
                    
                    <div className="space-y-3">
                      {/* הצעה ראשונית */}
                      {(mainInsight?.suggestion_primary || mainInsight?.suggestion) && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-3 border border-emerald-200 dark:border-emerald-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              הצעה ראשונית
                            </span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                const textToCopy = mainInsight?.suggestion_primary || mainInsight?.suggestion || '';
                                console.log('📋 Primary suggestion copy:', textToCopy);
                                copyToClipboard(textToCopy);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm leading-relaxed">
                            {mainInsight?.suggestion_primary || mainInsight?.suggestion}
                          </p>
                          {mainInsight?.suggestion_primary && (
                            <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                              ✓ הצעה מפורטת זמינה
                            </div>
                          )}
                        </div>
                      )}

                      {/* הצעה משנית */}
                      {mainInsight?.suggestion_secondary && (
                        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                              הצעה משנית
                            </span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                console.log('📋 Secondary suggestion copy:', mainInsight?.suggestion_secondary);
                                copyToClipboard(mainInsight?.suggestion_secondary || '');
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-sm leading-relaxed">
                            {mainInsight.suggestion_secondary}
                          </p>
                          <div className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                            ✓ הצעה חלופית זמינה
                          </div>
                        </div>
                      )}

                      {/* הצעות נוספות */}
                      {Array.isArray(mainInsight?.alternatives) && mainInsight.alternatives.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-950/20 rounded-md p-3 border border-slate-200 dark:border-slate-800">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-2">
                            הצעות נוספות
                          </span>
                          <ul className="space-y-2">
                            {mainInsight.alternatives.map((alt, index) => (
                              <li key={index} className="flex items-start justify-between gap-2">
                                <span className="text-sm leading-relaxed flex-1">{alt}</span>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => copyToClipboard(alt)}
                                  className="h-6 w-6 p-0 flex-shrink-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Debug info */}
                      {(!mainInsight?.suggestion_primary && !mainInsight?.suggestion_secondary) && (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-md p-2 border border-yellow-200 dark:border-yellow-800">
                          <div className="text-xs text-yellow-700 dark:text-yellow-300">
                            🐛 Debug: לא נמצאו הצעות מפורטות חדשות
                            <br />suggestion: {mainInsight?.suggestion ? '✓' : '✗'}
                            <br />suggestion_primary: {mainInsight?.suggestion_primary ? '✓' : '✗'}
                            <br />suggestion_secondary: {mainInsight?.suggestion_secondary ? '✓' : '✗'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ממצאים נוספים אם יש */}
                  {critInsights.length > 1 && (
                    <div>
                      <Separator className="my-3" />
                      <h4 className="text-sm font-semibold mb-2">ממצאים נוספים ({critInsights.length - 1})</h4>
                      <div className="space-y-2">
                        {critInsights.slice(1).map((insight, index) => (
                          <div key={index} className="bg-muted/30 rounded-md p-2">
                            <p className="text-sm italic">"{insight.quote}"</p>
                            {insight.explanation && (
                              <p className="text-xs text-muted-foreground mt-1">{insight.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
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
