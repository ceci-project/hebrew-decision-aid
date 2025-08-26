
import React from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CRITERIA } from "@/data/criteria";
import { Insight } from "@/types/models";

interface Props {
  criteriaData?: Array<{
    id: string;
    name: string;
    weight: number;
    score: number;
    justification: string;
    evidence?: Array<{ quote: string; rangeStart: number; rangeEnd: number }>;
  }>;
  insights: Insight[];
  onJump?: (ins: Insight) => void;
}

const CriterionAccordion: React.FC<Props> = ({ criteriaData = [], insights, onJump }) => {
  return (
    <Accordion type="single" collapsible className="w-full space-y-2">
      {CRITERIA.map((criterion) => {
        const criterionData = criteriaData.find(c => c.id === criterion.id);
        const criterionInsights = insights.filter(ins => ins.criterionId === criterion.id);
        const score = criterionData?.score ?? 0;
        
        return (
          <AccordionItem 
            key={criterion.id} 
            value={criterion.id}
            className="border border-gray-200 rounded-lg px-3"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center justify-between w-full ml-2">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: `var(${criterion.colorVar})` }}
                  />
                  <span className="font-medium text-right">{criterion.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {criterionInsights.length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {criterionInsights.length}
                    </Badge>
                  )}
                  {score > 0 && (
                    <span className="text-sm font-medium text-gray-600">
                      {score}/10
                    </span>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="pt-0 pb-3">
              {criterionData?.justification && (
                <div className="mb-3 text-sm text-gray-600 leading-relaxed">
                  {criterionData.justification}
                </div>
              )}
              
              {criterionInsights.length > 0 ? (
                <div className="space-y-2">
                  {criterionInsights.map((insight) => (
                    <div 
                      key={insight.id} 
                      className="p-3 bg-gray-50 rounded border border-gray-200 hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => onJump?.(insight)}
                    >
                      <div className="text-sm text-gray-700 mb-2">
                        "{insight.quote}"
                      </div>
                      
                      {insight.explanation && (
                        <div className="text-xs text-gray-600 mb-2">
                          {insight.explanation}
                        </div>
                      )}
                      
                      {/* Show available suggestions consistently */}
                      <div className="space-y-1">
                        {insight.suggestion && (
                          <div className="text-xs text-blue-600">
                            💡 יש הצעה לשיפור
                          </div>
                        )}
                        {insight.suggestion_primary && (
                          <div className="text-xs text-green-600">
                            ✅ הצעה ראשונית זמינה
                          </div>
                        )}
                        {insight.suggestion_secondary && (
                          <div className="text-xs text-orange-600">
                            🔄 הצעה משנית זמינה
                          </div>
                        )}
                        {(insight.patchBalanced || insight.patchExtended) && (
                          <div className="text-xs text-purple-600">
                            🎯 תיקון מוצע זמין
                          </div>
                        )}
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJump?.(insight);
                        }}
                      >
                        מצא בטקסט
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 italic">
                  לא נמצאו ממצאים לקריטריון זה
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
};

export default CriterionAccordion;
