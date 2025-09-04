import React, { useState, useRef, useEffect } from 'react';
import { X, Move, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { CRITERIA_MAP } from '@/data/criteria';
import { Insight } from '@/types/models';

interface InsightPanelProps {
  insights: Insight[];
  quotes: any[];
  onClose: () => void;
  initialPosition?: { x: number; y: number };
  criteria?: any[];
}

const InsightPanel: React.FC<InsightPanelProps> = ({ 
  insights, 
  quotes, 
  onClose,
  initialPosition = { x: 20, y: 100 },
  criteria = []
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  
  // Group insights by criterion
  const insightsByCriterion = insights.reduce((acc, insight) => {
    if (!acc[insight.criterionId]) {
      acc[insight.criterionId] = [];
    }
    acc[insight.criterionId].push(insight);
    return acc;
  }, {} as Record<string, Insight[]>);
  
  // Get unique criteria
  const uniqueCriteria = Object.keys(insightsByCriterion);
  
  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      dragStartPos.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y
      };
      e.preventDefault();
    }
  };
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStartPos.current.x,
          y: e.clientY - dragStartPos.current.y
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);
  
  const toggleCriterion = (criterionId: string) => {
    const newExpanded = new Set(expandedCriteria);
    if (newExpanded.has(criterionId)) {
      newExpanded.delete(criterionId);
    } else {
      newExpanded.add(criterionId);
    }
    setExpandedCriteria(newExpanded);
  };
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  
  // Initialize with all criteria expanded
  useEffect(() => {
    setExpandedCriteria(new Set(uniqueCriteria));
  }, []);
  
  return (
    <div
      ref={panelRef}
      className="insight-panel"
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '400px',
        maxWidth: '90vw',
        maxHeight: '80vh',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid rgba(0, 0, 0, 0.1)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header with drag handle */}
      <div 
        className="drag-handle"
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          cursor: isDragging ? 'grabbing' : 'grab',
          background: 'rgba(249, 250, 251, 1)',
          borderRadius: '12px 12px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Move size={16} style={{ opacity: 0.5 }} />
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            תובנות והמלצות ({uniqueCriteria.length} קריטריונים)
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <X size={18} />
        </button>
      </div>
      
      {/* Content area with scroll */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px',
        maxHeight: 'calc(80vh - 60px)'
      }}>
        {uniqueCriteria.map(criterionId => {
          const criterion = CRITERIA_MAP[criterionId];
          const criterionInsights = insightsByCriterion[criterionId];
          const isExpanded = expandedCriteria.has(criterionId);
          const criterionData = criteria.find(c => c.id === criterionId);
          const score = criterionData?.score;
          
          return (
            <div key={criterionId} style={{ marginBottom: '16px' }}>
              {/* Criterion header */}
              <div
                onClick={() => toggleCriterion(criterionId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  background: 'rgba(249, 250, 251, 1)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  marginBottom: isExpanded ? '8px' : '0',
                  transition: 'all 0.2s',
                  border: '1px solid rgba(0, 0, 0, 0.05)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: `hsl(var(${criterion?.colorVar || '--crit-timeline'}))`
                    }}
                  />
                  <span style={{ fontWeight: 500, fontSize: '14px' }}>
                    {criterion?.name || criterionId}
                  </span>
                  {score !== undefined && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: score >= 4 ? 'rgba(34, 197, 94, 0.1)' : 
                                   score >= 2 ? 'rgba(251, 146, 60, 0.1)' : 
                                   'rgba(239, 68, 68, 0.1)',
                        color: score >= 4 ? 'rgb(34, 197, 94)' : 
                               score >= 2 ? 'rgb(251, 146, 60)' : 
                               'rgb(239, 68, 68)'
                      }}
                    >
                      {score}/5
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              
              {/* Expanded content */}
              {isExpanded && (
                <div style={{ paddingRight: '20px' }}>
                  {criterionInsights.map((insight, idx) => (
                    <div key={insight.id || idx} style={{ marginBottom: '12px' }}>
                      {/* Quotes */}
                      {insight.quotes && insight.quotes.length > 0 ? (
                        insight.quotes.map((quote: any, qIdx: number) => (
                          <div key={qIdx} style={{ marginBottom: '8px' }}>
                            <div style={{ 
                              fontSize: '12px', 
                              color: 'rgba(107, 114, 128, 1)',
                              marginBottom: '4px' 
                            }}>
                              ציטוט {qIdx + 1}:
                            </div>
                            <blockquote style={{
                              margin: 0,
                              padding: '8px 12px',
                              background: 'rgba(249, 250, 251, 1)',
                              borderRight: `3px solid hsl(var(${criterion?.colorVar || '--crit-timeline'}))`,
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontStyle: 'italic',
                              position: 'relative'
                            }}>
                              "{quote.text || quote}"
                              <button
                                onClick={() => copyToClipboard(quote.text || quote)}
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  left: '4px',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  opacity: 0.5,
                                  transition: 'opacity 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}
                              >
                                <Copy size={12} />
                              </button>
                            </blockquote>
                          </div>
                        ))
                      ) : insight.quote ? (
                        <blockquote style={{
                          margin: '0 0 8px 0',
                          padding: '8px 12px',
                          background: 'rgba(249, 250, 251, 1)',
                          borderRight: `3px solid hsl(var(${criterion?.colorVar || '--crit-timeline'}))`,
                          borderRadius: '4px',
                          fontSize: '13px',
                          fontStyle: 'italic'
                        }}>
                          "{insight.quote}"
                        </blockquote>
                      ) : null}
                      
                      {/* Explanation */}
                      {insight.explanation && (
                        <div style={{ 
                          marginBottom: '8px',
                          fontSize: '13px',
                          color: 'rgba(55, 65, 81, 1)',
                          lineHeight: '1.5'
                        }}>
                          <strong>הסבר:</strong> {insight.explanation}
                        </div>
                      )}
                      
                      {/* Suggestions */}
                      {(insight.suggestion_primary || insight.suggestion) && (
                        <div style={{
                          padding: '8px 12px',
                          background: 'rgba(34, 197, 94, 0.05)',
                          borderRadius: '6px',
                          borderRight: '3px solid rgba(34, 197, 94, 0.5)',
                          marginBottom: '6px'
                        }}>
                          <div style={{ 
                            fontSize: '12px', 
                            fontWeight: 600,
                            color: 'rgba(34, 197, 94, 1)',
                            marginBottom: '4px'
                          }}>
                            המלצה ראשית:
                          </div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            {insight.suggestion_primary || insight.suggestion}
                          </div>
                        </div>
                      )}
                      
                      {insight.suggestion_secondary && (
                        <div style={{
                          padding: '8px 12px',
                          background: 'rgba(59, 130, 246, 0.05)',
                          borderRadius: '6px',
                          borderRight: '3px solid rgba(59, 130, 246, 0.5)'
                        }}>
                          <div style={{ 
                            fontSize: '12px', 
                            fontWeight: 600,
                            color: 'rgba(59, 130, 246, 1)',
                            marginBottom: '4px'
                          }}>
                            המלצה משנית:
                          </div>
                          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                            {insight.suggestion_secondary}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InsightPanel;