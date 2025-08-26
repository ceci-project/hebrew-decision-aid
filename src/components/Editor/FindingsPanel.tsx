
import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Insight } from "@/types/models";
import FindingsAccordion from "./FindingsAccordion";
import SimplifiedFindings from "./SimplifiedFindings";
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
    <Tabs defaultValue="criteria" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="criteria">סיכום מהיר</TabsTrigger>
        <TabsTrigger value="detailed">תצוגה מפורטת</TabsTrigger>
        <TabsTrigger value="simplified">תצוגה פשוטה</TabsTrigger>
      </TabsList>
      
      <TabsContent value="criteria" className="mt-4">
        <CriterionAccordion 
          criteriaData={criteriaData} 
          insights={insights} 
          onJump={onJump} 
        />
      </TabsContent>
      
      <TabsContent value="detailed" className="mt-4">
        <FindingsAccordion insights={insights} onJump={onJump} />
      </TabsContent>
      
      <TabsContent value="simplified" className="mt-4">
        <SimplifiedFindings insights={insights} onJumpToText={onJump} />
      </TabsContent>
    </Tabs>
  );
};

export default FindingsPanel;
