import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MousePointer } from 'lucide-react';
import { CRITERIA_MAP } from '@/data/criteria';
import { Insight } from '@/types/models';

interface QuoteTooltipProps {
  insights: Insight[];
  quotes: any[];
  position: { x: number; y: number };
  onClose?: () => void;
  criteria?: any[];
}

const QuoteTooltip: React.FC<QuoteTooltipProps> = ({ 
  insights, 
  quotes, 
  position,
  onClose,
  criteria = []
}) => {
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  
  // Get unique criteria from all insights
  const uniqueCriteria = Array.from(new Set(insights.map(i => i.criterionId)));
  
  // Get the quote text from the first insight or quote
  const quoteText = quotes.length > 0 && quotes[0]?.text 
    ? quotes[0].text 
    : insights[0]?.quote || '';
  
  // Get all suggestions/insights for this quote
  const allSuggestions = insights.filter(i => i.suggestion_primary || i.suggestion);
  
  const currentSuggestion = allSuggestions[currentSuggestionIndex];
  
  useEffect(() => {
    // Reset index when insights change
    setCurrentSuggestionIndex(0);
  }, [insights]);
  
  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentSuggestionIndex > 0) {
        setCurrentSuggestionIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentSuggestionIndex < allSuggestions.length - 1) {
        setCurrentSuggestionIndex(prev => prev + 1);
      } else if (e.key === 'Escape') {
        onClose?.();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSuggestionIndex, allSuggestions.length, onClose]);
  
  // Calculate tooltip position to keep it on screen
  const tooltipStyle: React.CSSProperties = {
    left: Math.min(position.x, window.innerWidth - 520),
    top: Math.max(position.y - 100, 20),
  };
  
  
  return (
    <div 
      className="multi-quote-tooltip" 
      style={{
        ...tooltipStyle,
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => {
        // Cancel any pending hide when mouse enters tooltip
        const hideTimeout = (window as any).hideTooltipTimeout;
        if (hideTimeout) {
          clearTimeout(hideTimeout);
        }
      }}
      onMouseLeave={() => {
        // When mouse leaves the tooltip entirely, close it
        onClose?.();
      }}
>
      {/* Criteria badges with scores */}
      <div className="criteria-badges">
        {uniqueCriteria.map(criterionId => {
          const criterion = CRITERIA_MAP[criterionId];
          const criterionData = criteria.find(c => c.id === criterionId);
          const score = criterionData?.score;
          if (!criterion) return null;
          
          return (
            <div key={criterionId} className="criterion-badge">
              <span 
                className="criterion-dot"
                style={{ 
                  background: `hsl(var(${criterion.colorVar}))` 
                }}
              />
              <span>{criterion.name}</span>
              {score !== undefined && (
                <span style={{
                  marginRight: '4px',
                  padding: '1px 4px',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  background: score >= 4 ? 'rgba(34, 197, 94, 0.2)' : 
                             score >= 2 ? 'rgba(251, 146, 60, 0.2)' : 
                             'rgba(239, 68, 68, 0.2)',
                  color: score >= 4 ? 'rgb(34, 197, 94)' : 
                         score >= 2 ? 'rgb(251, 146, 60)' : 
                         'rgb(239, 68, 68)'
                }}>
                  {score}/5
                </span>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Suggestion navigation */}
      {allSuggestions.length > 1 && (
        <div className="quote-navigation">
          <span className="quote-counter">
            המלצה {currentSuggestionIndex + 1} מתוך {allSuggestions.length}
          </span>
          <div className="nav-buttons">
            <button
              className="nav-button"
              onClick={() => setCurrentSuggestionIndex(prev => prev - 1)}
              disabled={currentSuggestionIndex === 0}
              style={{ pointerEvents: 'auto' }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="nav-button"
              onClick={() => setCurrentSuggestionIndex(prev => prev + 1)}
              disabled={currentSuggestionIndex === allSuggestions.length - 1}
              style={{ pointerEvents: 'auto' }}
            >
              <ChevronLeft size={14} />
            </button>
          </div>
        </div>
      )}
      
      {/* Quote text (stays the same for all suggestions) */}
      {quoteText && (
        <div 
          className="quote-text"
          style={{
            borderRightColor: `hsl(var(${CRITERIA_MAP[currentSuggestion?.criterionId]?.colorVar || '--crit-timeline'}))`
          }}
        >
          "{quoteText.length > 150 
            ? quoteText.substring(0, 150) + '...' 
            : quoteText}"
        </div>
      )}
      
      {/* Current suggestion */}
      {currentSuggestion && (currentSuggestion.suggestion_primary || currentSuggestion.suggestion) && (
        <div style={{
          padding: '8px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '6px',
          marginBottom: '8px',
          borderRight: `2px solid hsl(var(${CRITERIA_MAP[currentSuggestion.criterionId]?.colorVar || '--crit-timeline'}))`
        }}>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 'bold',
            color: 'rgba(34, 197, 94, 1)',
            marginBottom: '4px'
          }}>
            {CRITERIA_MAP[currentSuggestion.criterionId]?.name || 'המלצה'}:
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: 'rgba(229, 231, 235, 1)',
            lineHeight: '1.4'
          }}>
            {(currentSuggestion.suggestion_primary || currentSuggestion.suggestion).length > 80
              ? (currentSuggestion.suggestion_primary || currentSuggestion.suggestion).substring(0, 80) + '...'
              : (currentSuggestion.suggestion_primary || currentSuggestion.suggestion)}
          </div>
        </div>
      )}
      
      {/* Insight explanation if available */}
      {currentSuggestion?.explanation && (
        <div style={{ 
          fontSize: '12px', 
          color: 'rgba(209, 213, 219, 1)',
          marginBottom: '8px',
          lineHeight: '1.4'
        }}>
          {currentSuggestion.explanation.length > 100
            ? currentSuggestion.explanation.substring(0, 100) + '...'
            : currentSuggestion.explanation}
        </div>
      )}
      
      {/* Hint text */}
      <div className="hint-text">
        <MousePointer size={12} />
        <span>לחץ לפרטים נוספים בסרגל הצד</span>
        {allSuggestions.length > 1 && (
          <span style={{ marginRight: '8px' }}>• השתמש בחיצים למעבר בין המלצות</span>
        )}
      </div>
    </div>
  );
};

export default QuoteTooltip;