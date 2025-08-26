
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Insight } from "@/types/models";
import { CRITERIA_MAP } from "@/data/criteria";
import { ArrowRight, Copy } from "lucide-react";

interface Props {
  insight: Insight;
  onJumpToText?: (insight: Insight) => void;
}

const CriterionDisplay: React.FC<Props> = ({ insight, onJumpToText }) => {
  const criterion = CRITERIA_MAP[insight.criterionId as keyof typeof CRITERIA_MAP];
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      // Silent fail
    }
  };

  if (!criterion) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span 
              className="inline-block h-4 w-4 rounded" 
              style={{ background: `hsl(var(${criterion.colorVar}))` }}
              aria-hidden
            />
            <CardTitle className="text-lg">{criterion.name}</CardTitle>
          </div>
          {insight.severity && (
            <Badge 
              variant={insight.severity === 'critical' ? 'destructive' : 
                      insight.severity === 'moderate' ? 'secondary' : 'outline'}
              className="text-xs"
            >
              {insight.severity === 'critical' ? 'קריטי' : 
               insight.severity === 'moderate' ? 'בינוני' : 'קל'}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* הסבר כללי */}
        {insight.explanation && (
          <div>
            <h4 className="text-sm font-semibold mb-2">הסבר ותובנה כללית</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {insight.explanation}
            </p>
          </div>
        )}

        <Separator />

        {/* ציטוט מהמסמך */}
        {insight.quote && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold">ציטוט מהמסמך</h4>
              {onJumpToText && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onJumpToText(insight)}
                  className="text-xs"
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  מצא בטקסט
                </Button>
              )}
            </div>
            <blockquote className="bg-secondary/50 rounded-md p-3 border-r-4 border-primary/30">
              <p className="text-sm italic">"{insight.quote}"</p>
            </blockquote>
          </div>
        )}

        <Separator />

        {/* אתגר */}
        <div>
          <h4 className="text-sm font-semibold mb-2 text-amber-700 dark:text-amber-300">
            אתגר זוהה
          </h4>
          <p className="text-sm leading-relaxed">
            {insight.explanation || "נדרש שיפור בתחום זה על פי הרובריקה"}
          </p>
        </div>

        <Separator />

        {/* הצעות לשיפור */}
        <div>
          <h4 className="text-sm font-semibold mb-3 text-emerald-700 dark:text-emerald-300">
            הצעות לשיפור
          </h4>
          
          <div className="space-y-3">
            {/* הצעה ראשונית */}
            {(insight.suggestion_primary || insight.suggestion) && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-md p-3 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    הצעה ראשונית
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => copyToClipboard(insight.suggestion_primary || insight.suggestion)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm leading-relaxed">
                  {insight.suggestion_primary || insight.suggestion}
                </p>
              </div>
            )}

            {/* הצעה משנית */}
            {insight.suggestion_secondary && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    הצעה משנית
                  </span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => copyToClipboard(insight.suggestion_secondary)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm leading-relaxed">
                  {insight.suggestion_secondary}
                </p>
              </div>
            )}

            {/* הצעות נוספות מהמודל */}
            {Array.isArray(insight.alternatives) && insight.alternatives.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-950/20 rounded-md p-3 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    הצעות נוספות
                  </span>
                </div>
                <ul className="space-y-2">
                  {insight.alternatives.map((alt, index) => (
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CriterionDisplay;
