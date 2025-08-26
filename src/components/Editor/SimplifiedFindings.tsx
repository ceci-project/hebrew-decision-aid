
import React from "react";
import { Insight } from "@/types/models";
import { CRITERIA } from "@/data/criteria";
import CriterionDisplayFixed from "./CriterionDisplayFixed";

interface Props {
  insights: Insight[];
  onJumpToText?: (insight: Insight) => void;
}

const SimplifiedFindings: React.FC<Props> = ({ insights, onJumpToText }) => {
  // Group insights by criterion
  const insightsByCriterion = React.useMemo(() => {
    const grouped: Record<string, Insight[]> = {};
    
    // Initialize with all criteria
    CRITERIA.forEach(criterion => {
      grouped[criterion.id] = [];
    });
    
    // Group insights
    insights.forEach(insight => {
      if (grouped[insight.criterionId]) {
        grouped[insight.criterionId].push(insight);
      }
    });
    
    return grouped;
  }, [insights]);

  // Get criteria that have insights, sorted by the original criteria order
  const criteriaWithInsights = CRITERIA.filter(criterion => 
    insightsByCriterion[criterion.id] && insightsByCriterion[criterion.id].length > 0
  );

  if (criteriaWithInsights.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        לא נמצאו ממצאים לתצוגה
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">ממצאים לפי קריטריונים</h3>
        <p className="text-sm text-muted-foreground mt-1">
          נמצאו ממצאים עבור {criteriaWithInsights.length} קריטריונים
        </p>
      </div>
      
      {criteriaWithInsights.map(criterion => {
        const criterionInsights = insightsByCriterion[criterion.id];
        
        return (
          <div key={criterion.id}>
            {criterionInsights.map((insight, index) => (
              <CriterionDisplayFixed
                key={`${criterion.id}-${index}`}
                insight={insight}
                onJumpToText={onJumpToText}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default SimplifiedFindings;
