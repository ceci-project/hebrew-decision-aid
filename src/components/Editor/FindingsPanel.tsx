
import React from "react";
import { Insight } from "@/types/models";
import CriterionAccordion from "./CriterionAccordion";

interface Props {
  insights: Insight[];
  criteriaData?: Array<{
    id: string;
    name: string;
    weight: number;
    score: number;
    justification: string;
    evidence?: Array<{ quote: string; rangeStart: number; rangeEnd: number }>;
  }>;
  onJump?: (ins: Insight) => void;
}

const FindingsPanel: React.FC<Props> = ({ insights, criteriaData = [], onJump }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">ניתוח לפי קריטריונים</h3>
        {insights.length > 0 && (
          <span className="text-sm text-gray-500">{insights.length} ממצאים</span>
        )}
      </div>
      
      <CriterionAccordion 
        criteriaData={criteriaData} 
        insights={insights} 
        onJump={onJump} 
      />
    </div>
  );
};

export default FindingsPanel;
