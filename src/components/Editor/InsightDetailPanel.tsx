
import React from 'react';
import { Insight } from '@/types/models';
import { CRITERIA_MAP } from '@/data/criteria';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface Props {
  insight: Insight | null;
  onApplySuggestion?: (suggestion: string) => void;
  onClose?: () => void;
}

export const InsightDetailPanel: React.FC<Props> = ({
  insight,
  onApplySuggestion,
  onClose
}) => {
  if (!insight) {
    return (
      <div className="p-6 text-center text-gray-500">
        בחר הדגשה לצפייה בפרטים
      </div>
    );
  }

  const criterion = CRITERIA_MAP[insight.criterionId] || { 
    name: 'לא ידוע', 
    colorVar: '--crit-timeline' 
  };

  const suggestions = [
    insight.suggestion && { label: 'הצעה כללית', text: insight.suggestion },
    insight.suggestion_primary && { label: 'הצעה ראשונית', text: insight.suggestion_primary },
    insight.suggestion_secondary && { label: 'הצעה משנית', text: insight.suggestion_secondary },
    insight.patchBalanced && { label: 'מוצע (מאוזן)', text: insight.patchBalanced },
    insight.patchExtended && { label: 'מוצע (מורחב)', text: insight.patchExtended }
  ].filter(Boolean);

  return (
    <div className="p-6 space-y-6 max-h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {criterion.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {insight.severity && (
              <Badge 
                variant={
                  insight.severity === 'critical' ? 'destructive' :
                  insight.severity === 'moderate' ? 'default' : 'secondary'
                }
              >
                {insight.severity === 'critical' ? 'קריטי' :
                 insight.severity === 'moderate' ? 'בינוני' : 'קל'}
              </Badge>
            )}
            {insight.isStale && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                דורש עדכון
              </Badge>
            )}
          </div>
        </div>
        
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        )}
      </div>

      {/* Quote */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">הציטוט:</h4>
        <div 
          className="p-3 rounded border-l-4 bg-gray-50 text-sm"
          style={{ borderLeftColor: `hsl(var(${criterion.colorVar}))` }}
        >
          "{insight.quote}"
        </div>
      </div>

      {/* Explanation */}
      {insight.explanation && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">הסבר:</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {insight.explanation}
          </p>
        </div>
      )}

      <Separator />

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">הצעות לשיפור:</h4>
          <div className="space-y-3">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500">
                    {suggestion!.label}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplySuggestion?.(suggestion!.text)}
                    className="text-xs"
                  >
                    החלף בטקסט
                  </Button>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
                  {suggestion!.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alternatives */}
      {insight.alternatives && insight.alternatives.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">אלטרנטיבות:</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            {insight.alternatives.map((alt, index) => (
              <li key={index} className="flex items-start">
                <span className="text-gray-400 mr-2">•</span>
                {alt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      {(insight.createdAt || insight.source) && (
        <div className="pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 space-y-1">
            {insight.createdAt && (
              <div>נוצר: {new Date(insight.createdAt).toLocaleDateString('he-IL')}</div>
            )}
            {insight.source && (
              <div>מקור: {insight.source}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightDetailPanel;
