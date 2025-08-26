
import React from "react";
import { Insight } from "@/types/models";
import { CRITERIA } from "@/data/criteria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  insight: Insight;
  onJumpToText?: (insight: Insight) => void;
}

const CriterionDisplayFixed: React.FC<Props> = ({ insight, onJumpToText }) => {
  const criterion = CRITERIA.find(c => c.id === insight.criterionId);
  
  if (!criterion) {
    return null;
  }

  const handleViewInText = () => {
    if (onJumpToText) {
      onJumpToText(insight);
    }
  };

  return (
    <Card className="mb-4 border-r-4" style={{ borderRightColor: `var(${criterion.colorVar})` }}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className="text-xs"
              style={{ 
                backgroundColor: `var(${criterion.colorVar})20`,
                color: `var(${criterion.colorVar})`,
                border: `1px solid var(${criterion.colorVar})40`
              }}
            >
              {criterion.name}
            </Badge>
          </div>
          
          {insight.quote && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewInText}
              className="text-xs flex items-center gap-1"
            >
              <Eye className="h-3 w-3" />
              צפה בטקסט
            </Button>
          )}
        </div>
        
        {insight.quote && (
          <div className="mt-2 p-2 bg-muted rounded text-sm italic border-r-2" 
               style={{ borderRightColor: `var(${criterion.colorVar})` }}>
            "{insight.quote}"
          </div>
        )}
      </CardHeader>
      
      <CardContent className="pt-0">
        {insight.explanation && (
          <div className="mb-3">
            <h4 className="font-medium text-sm mb-1">הסבר:</h4>
            <p className="text-sm text-muted-foreground">{insight.explanation}</p>
          </div>
        )}
        
        {(insight.suggestion_primary || insight.suggestion) && (
          <div className="mb-3">
            <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              הצעה עיקרית:
            </h4>
            <p className="text-sm text-foreground bg-blue-50 p-2 rounded border-r-2 border-blue-300">
              {insight.suggestion_primary || insight.suggestion}
            </p>
          </div>
        )}
        
        {insight.suggestion_secondary && (
          <div>
            <h4 className="font-medium text-sm mb-1 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              הצעה חלופית:
            </h4>
            <p className="text-sm text-foreground bg-green-50 p-2 rounded border-r-2 border-green-300">
              {insight.suggestion_secondary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CriterionDisplayFixed;
