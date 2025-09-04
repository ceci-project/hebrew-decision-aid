import React, { useState, useRef } from 'react';
import { Insight } from '@/types/models';
import { CRITERIA_MAP } from '@/data/criteria';
import { X, Move } from 'lucide-react';

interface FloatingInsightDetailProps {
  insight: Insight;
  criteria?: Array<{ id: string; name: string; weight: number; score: number; justification: string }>;
  onClose: () => void;
}

export const FloatingInsightDetail: React.FC<FloatingInsightDetailProps> = ({
  insight,
  criteria = [],
  onClose
}) => {
  const criterionInfo = CRITERIA_MAP[insight.criterionId];
  const criterionScore = criteria.find(c => c.id === insight.criterionId);
  
  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ 
    x: window.innerWidth - 340, // Position to the right (320px width + 20px margin)
    y: 120 // Start below typical header area
  }); 
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Keep panel within viewport bounds
    const panel = panelRef.current;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width;
      const maxY = window.innerHeight - rect.height;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, position]);

  return (
    <>
      {/* Floating Panel - No backdrop, positioned absolutely */}
      <div 
        ref={panelRef}
        className="fixed z-50 bg-white rounded-lg shadow-2xl border border-gray-300 max-w-md w-80 max-h-[70vh] overflow-hidden"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Header with drag handle */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            {/* Drag Handle */}
            <div 
              className="drag-handle p-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing rounded"
              title="גרור להזזה"
            >
              <Move className="w-4 h-4" />
            </div>
            
            <span 
              className="inline-block w-3 h-3 rounded-full"
              style={{ 
                background: `hsl(var(${criterionInfo?.colorVar || '--crit-timeline'}))` 
              }}
            />
            <h2 className="text-base font-bold text-gray-900">
              {criterionInfo?.name || 'תובנה'}
            </h2>
            {criterionScore && (
              <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                criterionScore.score >= 4 ? 'bg-green-100 text-green-800' : 
                criterionScore.score >= 2 ? 'bg-yellow-100 text-yellow-800' : 
                'bg-red-100 text-red-800'
              }`}>
                {criterionScore.score}/5
              </div>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"
            title="סגור"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-3 overflow-y-auto max-h-[calc(70vh-60px)] text-sm">
          {/* Quote Section */}
          {insight.quote && (
            <div className="bg-gray-50 p-3 rounded border-r-2 border-blue-400">
              <h3 className="text-xs font-semibold text-gray-700 mb-1">ציטוט:</h3>
              <p className="text-gray-900 leading-snug italic text-xs">
                "{insight.quote}"
              </p>
              <div className="text-xs text-gray-500 mt-1">
                {insight.rangeStart}-{insight.rangeEnd}
              </div>
            </div>
          )}

          {/* Explanation */}
          {insight.explanation && (
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-gray-700">הסבר:</h3>
              <p className="text-gray-900 leading-snug text-xs">
                {insight.explanation}
              </p>
            </div>
          )}

          {/* Primary Suggestion */}
          {insight.suggestion_primary && (
            <div className="bg-blue-50 p-3 rounded">
              <h3 className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                המלצה ראשית
              </h3>
              <p className="text-blue-900 leading-snug text-xs">
                {insight.suggestion_primary}
              </p>
            </div>
          )}

          {/* Secondary Suggestion */}
          {insight.suggestion_secondary && (
            <div className="bg-green-50 p-3 rounded">
              <h3 className="text-xs font-semibold text-green-800 mb-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                המלצה משנית
              </h3>
              <p className="text-green-900 leading-snug text-xs">
                {insight.suggestion_secondary}
              </p>
            </div>
          )}

          {/* Legacy suggestion field */}
          {insight.suggestion && !insight.suggestion_primary && !insight.suggestion_secondary && (
            <div className="bg-blue-50 p-3 rounded">
              <h3 className="text-xs font-semibold text-blue-800 mb-1">הצעה:</h3>
              <p className="text-blue-900 leading-snug text-xs">
                {insight.suggestion}
              </p>
            </div>
          )}

          {/* Severity */}
          {insight.severity && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <span className="text-xs font-medium text-gray-700">חומרה:</span>
              <span className={`font-semibold px-2 py-1 rounded-full text-xs ${
                insight.severity === 'critical' ? 'bg-red-100 text-red-800' :
                insight.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {insight.severity === 'critical' ? 'קריטי' :
                 insight.severity === 'moderate' ? 'בינוני' : 'נמוך'}
              </span>
            </div>
          )}

          {/* Criterion Score Details */}
          {criterionScore && criterionScore.justification && (
            <div className="bg-gray-50 p-3 rounded">
              <h3 className="text-xs font-semibold text-gray-700 mb-2">הנמקת הציון:</h3>
              <p className="text-gray-900 text-xs leading-snug">
                {criterionScore.justification}
              </p>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200">
                <span className="text-xs text-gray-600">ציון: {criterionScore.score}/5</span>
                <span className="text-xs text-gray-600">משקל: {criterionScore.weight}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};