
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Insight } from '@/types/models';
import { CRITERIA_MAP } from '@/data/criteria';
import { AnchorManager } from '@/services/anchorManager';
import { UndoRedoManager } from '@/services/undoRedoManager';
import QuoteTooltip from './QuoteTooltip';
import InsightPanel from './InsightPanel';

interface Props {
  content: string;
  insights: Insight[];
  onContentChange: (content: string) => void;
  onInsightsChange: (insights: Insight[]) => void;
  onInsightSelect?: (insight: Insight | null) => void;
  selectedInsight?: Insight | null;
  criteria?: Array<{ id: string; name: string; weight: number; score: number; justification: string }>;
}

interface HighlightSpan {
  start: number;
  end: number;
  insight: Insight;
  element?: HTMLElement;
}

export const DecisionEditor: React.FC<Props> = ({
  content,
  insights,
  onContentChange,
  onInsightsChange,
  onInsightSelect,
  selectedInsight,
  criteria = []
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [highlightSpans, setHighlightSpans] = useState<HighlightSpan[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [undoRedoManager] = useState(() => new UndoRedoManager());
  const [hoveredInsight, setHoveredInsight] = useState<Insight | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<{ insights: Insight[]; quotes: any[] } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [clickedGroup, setClickedGroup] = useState<{ insights: Insight[]; quotes: any[] } | null>(null);
  const [isTooltipHovered, setIsTooltipHovered] = useState(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const hideTooltipTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCaretPositionRef = useRef<number>(0);

  // Save cursor position before updates
  const saveCursorPosition = useCallback(() => {
    if (!editorRef.current) return;
    
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      let offset = 0;
      
      const walker = document.createTreeWalker(
        editorRef.current,
        NodeFilter.SHOW_TEXT,
        null
      );
      
      let node = walker.nextNode();
      while (node && node !== range.startContainer) {
        offset += node.textContent?.length || 0;
        node = walker.nextNode();
      }
      
      if (node === range.startContainer) {
        offset += range.startOffset;
      }
      
      lastCaretPositionRef.current = offset;
    }
  }, []);

  // Restore cursor position after updates
  const restoreCursorPosition = useCallback(() => {
    if (!editorRef.current) return;
    
    const targetOffset = lastCaretPositionRef.current;
    let currentOffset = 0;
    
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node = walker.nextNode() as Text;
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      
      if (currentOffset + nodeLength >= targetOffset) {
        const selection = window.getSelection();
        const range = document.createRange();
        
        try {
          range.setStart(node, Math.min(targetOffset - currentOffset, nodeLength));
          range.collapse(true);
          
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (error) {
          // Silently handle cursor position errors
        }
        break;
      }
      
      currentOffset += nodeLength;
      node = walker.nextNode() as Text;
    }
  }, []);

  // Handle custom selectInsight event
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleSelectInsight = (event: CustomEvent) => {
      const { insight } = event.detail;
      const rangeStart = insight?.rangeStart;
      const rangeEnd = insight?.rangeEnd;
      const quote = insight?.quote;
      
      // Wait for editor to be ready and content to be rendered
      const scrollToText = () => {
        const currentContent = editor.textContent || '';
        
        // Validate that rangeStart and rangeEnd match the quote
        let actualRangeStart = rangeStart;
        let actualRangeEnd = rangeEnd;
        
        if (quote && currentContent) {
          const extractedText = currentContent.substring(rangeStart, rangeEnd);
          
          if (extractedText !== quote) {
            const foundIndex = currentContent.indexOf(quote);
            if (foundIndex !== -1) {
              actualRangeStart = foundIndex;
              actualRangeEnd = foundIndex + quote.length;
            } else {
              return;
            }
          }
        }
        
        const startNode = getTextNodeAtOffset(editor, actualRangeStart);
        
        if (startNode) {
          try {
            // Use range for scrolling
            const range = document.createRange();
            range.setStart(startNode.node, startNode.offset);
            range.setEnd(startNode.node, startNode.offset);
            
            range.getBoundingClientRect();
            
            // Scroll to the range
            startNode.node.parentElement?.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });
            
            // Highlight the text temporarily
            if (quote && actualRangeStart !== undefined && actualRangeEnd !== undefined) {
              const endNode = getTextNodeAtOffset(editor, actualRangeEnd);
              if (endNode) {
                const selection = window.getSelection();
                const highlightRange = document.createRange();
                highlightRange.setStart(startNode.node, startNode.offset);
                highlightRange.setEnd(endNode.node, endNode.offset);
                
                selection?.removeAllRanges();
                selection?.addRange(highlightRange);
                
                // Remove selection after 2 seconds
                setTimeout(() => {
                  selection?.removeAllRanges();
                }, 2000);
              }
            }
            
          } catch (error) {
            // Silently handle scrolling errors
          }
        } else {
          // Could not find text node for position
        }
      };
      
      // Check if content is ready, otherwise wait
      if (editor.textContent && editor.textContent.length > 0) {
        setTimeout(scrollToText, 100);
      } else {
        // Wait for content to load
        const checkContent = () => {
          if (editor.textContent && editor.textContent.length > 0) {
            scrollToText();
          } else {
            setTimeout(checkContent, 200);
          }
        };
        checkContent();
      }
    };

    editor.addEventListener('selectInsight', handleSelectInsight as EventListener);
    
    return () => {
      editor.removeEventListener('selectInsight', handleSelectInsight as EventListener);
    };
  }, []);

  // Debounced update function
  const debouncedUpdate = useCallback((newContent: string) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onContentChange(newContent);
      undoRedoManager.saveState(newContent);
    }, 200);
  }, [onContentChange, undoRedoManager]);

  // Handle text changes
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    if (isComposing) return;
    
    saveCursorPosition();
    
    const newContent = e.currentTarget.textContent || '';
    
    // Update insights positions based on the change
    const updatedInsights = insights.map(insight => 
      AnchorManager.enhanceInsightWithAnchors(insight, newContent)
    );
    
    onInsightsChange(updatedInsights);
    debouncedUpdate(newContent);
  }, [insights, onInsightsChange, debouncedUpdate, isComposing, saveCursorPosition]);

  // Handle undo/redo
  const handleUndo = useCallback(() => {
    const previousContent = undoRedoManager.undo();
    if (previousContent !== null) {
      onContentChange(previousContent);
      
      // Update insights for the restored content
      const updatedInsights = insights.map(insight => 
        AnchorManager.enhanceInsightWithAnchors(insight, previousContent)
      );
      onInsightsChange(updatedInsights);
    }
  }, [undoRedoManager, onContentChange, insights, onInsightsChange]);

  const handleRedo = useCallback(() => {
    const nextContent = undoRedoManager.redo();
    if (nextContent !== null) {
      onContentChange(nextContent);
      
      // Update insights for the restored content
      const updatedInsights = insights.map(insight => 
        AnchorManager.enhanceInsightWithAnchors(insight, nextContent)
      );
      onInsightsChange(updatedInsights);
    }
  }, [undoRedoManager, onContentChange, insights, onInsightsChange]);

  // Helper function to map original text positions to DOM positions
  const mapTextPositionToDOM = useCallback((position: number, originalContent: string): number => {
    // Count newlines before this position in the original content
    const beforePosition = originalContent.substring(0, position);
    const newlineCount = (beforePosition.match(/\n/g) || []).length;
    
    // In DOM, each \n becomes <br>, which doesn't add to textContent length
    // So the position remains the same, accounting for removed newlines
    return position - newlineCount;
  }, []);

  // Render highlights with better performance
  const renderHighlights = useCallback(() => {
    if (!editorRef.current) return;

    const editor = editorRef.current;
    const textContent = editor.textContent || '';
    
    // Clear existing highlights
    const existingHighlights = editor.querySelectorAll('.insight-highlight');
    existingHighlights.forEach(el => el.remove());

    // Create new highlight spans
    const spans: HighlightSpan[] = [];
    const sortedInsights = [...insights]
      .filter(i => !i.isStale)
      .sort((a, b) => a.rangeStart - b.rangeStart);

    console.log('🎨 Rendering highlights - Total insights:', sortedInsights.length);
    
    sortedInsights.forEach((insight, index) => {
      // Handle multiple quotes if present
      const quotesToRender = insight.quotes && insight.quotes.length > 0 
        ? insight.quotes 
        : [{ text: insight.quote, rangeStart: insight.rangeStart, rangeEnd: insight.rangeEnd }];
      
      quotesToRender.forEach((quote, quoteIndex) => {
        // Map original text positions to DOM positions
        const originalStart = quote.rangeStart;
        const originalEnd = quote.rangeEnd;
        
        const domStart = mapTextPositionToDOM(originalStart, content);
        const domEnd = mapTextPositionToDOM(originalEnd, content);
        
        const start = Math.max(0, Math.min(domStart, textContent.length));
        const end = Math.max(start, Math.min(domEnd, textContent.length));
        
        console.log(`🎨 Insight ${index} Quote ${quoteIndex}:`, {
          id: insight.id,
          criterionId: insight.criterionId,
          quoteId: quote.id,
          originalRange: `${originalStart}-${originalEnd}`,
          domRange: `${domStart}-${domEnd}`,
          finalRange: `${start}-${end}`,
          quoteText: quote.text?.substring(0, 30) + '...'
        });
        
        if (start < end) {
          spans.push({ 
            start, 
            end, 
            insight,
            quoteId: quote.id,
            quoteIndex
          });
        }
      });
    });

    // Group overlapping spans to create combined highlights
    const groupedSpans: { 
      start: number; 
      end: number; 
      insights: Insight[];
      quoteIds: string[];
      quotes: Array<{ id: string; insightId: string; criterionId: string }>;
    }[] = [];
    const processedIndices = new Set<number>();
    
    for (let i = 0; i < spans.length; i++) {
      if (processedIndices.has(i)) continue;
      
      const currentSpan = spans[i];
      const overlappingGroup = {
        start: currentSpan.start,
        end: currentSpan.end,
        insights: [currentSpan.insight],
        quoteIds: [currentSpan.quoteId].filter(Boolean),
        quotes: currentSpan.quoteId ? [{
          id: currentSpan.quoteId,
          insightId: currentSpan.insight.id,
          criterionId: currentSpan.insight.criterionId
        }] : []
      };
      
      processedIndices.add(i);
      
      // Find all spans that overlap with this one
      for (let j = i + 1; j < spans.length; j++) {
        if (processedIndices.has(j)) continue;
        
        const otherSpan = spans[j];
        
        // Check if spans overlap
        if (overlappingGroup.start < otherSpan.end && otherSpan.start < overlappingGroup.end) {
          // Merge the ranges
          overlappingGroup.start = Math.min(overlappingGroup.start, otherSpan.start);
          overlappingGroup.end = Math.max(overlappingGroup.end, otherSpan.end);
          
          // Add the insight if it's a different criterion
          if (!overlappingGroup.insights.some(ins => ins.criterionId === otherSpan.insight.criterionId)) {
            overlappingGroup.insights.push(otherSpan.insight);
          }
          
          // Add quote info
          if (otherSpan.quoteId) {
            overlappingGroup.quoteIds.push(otherSpan.quoteId);
            overlappingGroup.quotes.push({
              id: otherSpan.quoteId,
              insightId: otherSpan.insight.id,
              criterionId: otherSpan.insight.criterionId
            });
          }
          
          processedIndices.add(j);
          
          console.log('🎨 Merging overlapping insights:', {
            insights: overlappingGroup.insights.map(ins => ({ id: ins.id, criterion: ins.criterionId })),
            quoteIds: overlappingGroup.quoteIds,
            range: `${overlappingGroup.start}-${overlappingGroup.end}`
          });
        }
      }
      
      groupedSpans.push(overlappingGroup);
    }
    
    console.log('🎨 Grouped spans:', groupedSpans.length, 'from original:', spans.length);

    setHighlightSpans(spans); // Keep original for other uses
    
    // Apply visual highlights using CSS positioning with improved performance
    requestAnimationFrame(() => {
      groupedSpans.forEach((group, groupIndex) => {
        const range = document.createRange();
        const textNode = getTextNodeAtOffset(editor, group.start);
        const endTextNode = getTextNodeAtOffset(editor, group.end);
        
        if (textNode && endTextNode) {
          try {
            range.setStart(textNode.node, textNode.offset);
            range.setEnd(endTextNode.node, endTextNode.offset);
            
            // Get client rects to handle multi-line highlights properly
            const clientRects = range.getClientRects();
            const editorRect = editor.getBoundingClientRect();
            
            console.log(`🎨 Creating ${clientRects.length} rectangles for ${group.insights.length} insights`);
            
            if (clientRects.length > 0) {
              // Get all unique criteria for this group
              const criteria = group.insights.map(ins => 
                CRITERIA_MAP[ins.criterionId] || { colorVar: '--crit-timeline' }
              );
              const isAnySelected = group.insights.some(ins => selectedInsight?.id === ins.id);
              
              Array.from(clientRects).forEach((rect, index) => {
                if (rect.width > 0 && rect.height > 0) {
                  const highlight = document.createElement('div');
                  
                  // Add consistent class names and data attributes for grouping
                  const insightClasses = group.insights.map(ins => `insight-${ins.id}`).join(' ');
                  highlight.className = `insight-highlight ${insightClasses} absolute pointer-events-none rounded-sm transition-colors duration-150 ${
                    isAnySelected ? 'ring-2 ring-primary/50' : ''
                  }`;
                  
                  // Add data attributes for debugging and grouping
                  highlight.setAttribute('data-insight-ids', group.insights.map(ins => ins.id).join(','));
                  highlight.setAttribute('data-criterion-ids', group.insights.map(ins => ins.criterionId).join(','));
                  highlight.setAttribute('data-quote-ids', group.quoteIds.join(','));
                  highlight.setAttribute('data-segment', index.toString());
                  
                  // Store quote data for navigation
                  if (group.quotes.length > 0) {
                    highlight.setAttribute('data-quote-data', JSON.stringify(group.quotes));
                  }
                  
                  // Create background based on number of overlapping insights
                  let backgroundStyle = '';
                  let borderStyle = '';
                  
                  // Map criterion colors directly
                  const getColorForCriterion = (colorVar: string) => {
                    // Map CSS variable to actual HSL value with opacity
                    const colorMap: Record<string, string> = {
                      '--crit-timeline': 'hsla(25, 87%, 56%, 0.35)',
                      '--crit-integrator': 'hsla(142, 71%, 45%, 0.35)',
                      '--crit-reporting': 'hsla(199, 89%, 48%, 0.35)',
                      '--crit-evaluation': 'hsla(262, 52%, 47%, 0.35)',
                      '--crit-external-audit': 'hsla(339, 69%, 52%, 0.35)',
                      '--crit-resources': 'hsla(43, 96%, 56%, 0.35)',
                      '--crit-multi-levels': 'hsla(173, 58%, 39%, 0.35)',
                      '--crit-structure': 'hsla(220, 14%, 46%, 0.35)',
                      '--crit-field-implementation': 'hsla(15, 79%, 54%, 0.35)',
                      '--crit-arbitrator': 'hsla(280, 61%, 50%, 0.35)',
                      '--crit-cross-sector': 'hsla(192, 91%, 36%, 0.35)',
                      '--crit-outcomes': 'hsla(84, 82%, 44%, 0.35)'
                    };
                    return colorMap[colorVar] || 'hsla(25, 87%, 56%, 0.35)';
                  };
                  
                  const getBorderColor = (colorVar: string) => {
                    const colorMap: Record<string, string> = {
                      '--crit-timeline': 'hsla(25, 87%, 56%, 0.7)',
                      '--crit-integrator': 'hsla(142, 71%, 45%, 0.7)',
                      '--crit-reporting': 'hsla(199, 89%, 48%, 0.7)',
                      '--crit-evaluation': 'hsla(262, 52%, 47%, 0.7)',
                      '--crit-external-audit': 'hsla(339, 69%, 52%, 0.7)',
                      '--crit-resources': 'hsla(43, 96%, 56%, 0.7)',
                      '--crit-multi-levels': 'hsla(173, 58%, 39%, 0.7)',
                      '--crit-structure': 'hsla(220, 14%, 46%, 0.7)',
                      '--crit-field-implementation': 'hsla(15, 79%, 54%, 0.7)',
                      '--crit-arbitrator': 'hsla(280, 61%, 50%, 0.7)',
                      '--crit-cross-sector': 'hsla(192, 91%, 36%, 0.7)',
                      '--crit-outcomes': 'hsla(84, 82%, 44%, 0.7)'
                    };
                    return colorMap[colorVar] || 'hsla(25, 87%, 56%, 0.7)';
                  };
                  
                  if (group.insights.length === 1) {
                    // Single insight - use solid color with better visibility
                    const criterion = criteria[0];
                    backgroundStyle = getColorForCriterion(criterion.colorVar);
                    borderStyle = `2px solid ${getBorderColor(criterion.colorVar)}`;
                  } else {
                    // Multiple insights - create diagonal stripes for better visibility
                    const colors = criteria.map(c => getColorForCriterion(c.colorVar));
                    
                    if (criteria.length === 2) {
                      // Two colors - simple diagonal gradient
                      backgroundStyle = `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 50%, ${colors[1]} 50%, ${colors[1]} 100%)`;
                    } else {
                      // Multiple colors - create stripes
                      const stripeWidth = 100 / criteria.length;
                      const stripes = colors.map((color, i) => {
                        const start = i * stripeWidth;
                        const end = (i + 1) * stripeWidth;
                        return `${color} ${start}%, ${color} ${end}%`;
                      }).join(', ');
                      backgroundStyle = `linear-gradient(135deg, ${stripes})`;
                    }
                    
                    borderStyle = `2px solid ${getBorderColor(criteria[0].colorVar)}`;
                  }
                  
                  // Ensure consistent styling across all segments
                  highlight.style.cssText = `
                    left: ${rect.left - editorRect.left}px;
                    top: ${rect.top - editorRect.top}px;
                    width: ${rect.width}px;
                    height: ${rect.height}px;
                    background: ${backgroundStyle};
                    border: ${borderStyle};
                    z-index: ${10 + groupIndex};
                    pointer-events: auto;
                    cursor: pointer;
                  `;
                  
                  highlight.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Show insight panel on left side
                    setClickedGroup({
                      insights: group.insights,
                      quotes: group.quotes || []
                    });
                  });
                  
                  // Add hover events for enhanced multi-quote tooltip (if enabled)
                  const tooltipsEnabled = import.meta.env.VITE_ENABLE_HOVER_TOOLTIPS === 'true';
                  console.log('🎯 Hover tooltips enabled:', tooltipsEnabled, 'ENV value:', import.meta.env.VITE_ENABLE_HOVER_TOOLTIPS);
                  
                  if (tooltipsEnabled) {
                    highlight.addEventListener('mouseenter', (e) => {
                      // Show all insights and quotes for this group
                      setHoveredGroup({ 
                        insights: group.insights, 
                        quotes: group.quotes || [] 
                      });
                      setTooltipPosition({ x: e.clientX, y: e.clientY - 60 });
                    });
                    
                    highlight.addEventListener('mouseleave', (e) => {
                      // Check if mouse is moving to the tooltip
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (relatedTarget && relatedTarget.closest('.multi-quote-tooltip')) {
                        // Mouse is moving to tooltip, don't hide
                        return;
                      }
                      
                      // Add small delay to allow mouse to move to tooltip
                      if (hideTooltipTimeoutRef.current) {
                        clearTimeout(hideTooltipTimeoutRef.current);
                      }
                      hideTooltipTimeoutRef.current = setTimeout(() => {
                        setHoveredGroup(null);
                        setHoveredInsight(null);
                        setTooltipPosition(null);
                      }, 100);
                      // Expose to window so tooltip can cancel it
                      (window as any).hideTooltipTimeout = hideTooltipTimeoutRef.current;
                    });
                    
                    highlight.addEventListener('mousemove', (e) => {
                      if (hoveredInsight || hoveredGroup) {
                        setTooltipPosition({ x: e.clientX, y: e.clientY - 60 });
                      }
                    });
                  }
                  
                  // Add quote count badge if multiple quotes
                  if (group.quotes && group.quotes.length > 1) {
                    const badge = document.createElement('div');
                    badge.className = 'quote-count-badge';
                    badge.textContent = group.quotes.length.toString();
                    badge.style.cssText = `
                      position: absolute;
                      top: -6px;
                      right: -6px;
                      width: 18px;
                      height: 18px;
                      border-radius: 50%;
                      background: hsl(var(${criteria[0].colorVar}) / 0.9);
                      color: white;
                      font-size: 11px;
                      font-weight: bold;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      border: 2px solid white;
                      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                      z-index: ${11 + groupIndex};
                      pointer-events: none;
                    `;
                    highlight.appendChild(badge);
                  }
                  
                  editor.appendChild(highlight);
                }
              });
            }
          } catch (error) {
            // Silently handle highlight range errors
          }
        }
      });
      
      // Restore cursor position after highlighting
      restoreCursorPosition();
    });
  }, [insights, selectedInsight, onInsightSelect, restoreCursorPosition, content, mapTextPositionToDOM]);

  // Helper function to find text node at specific offset
  const getTextNodeAtOffset = (container: Node, offset: number): { node: Text; offset: number } | null => {
    let currentOffset = 0;
    
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    let node: Text | null = walker.nextNode() as Text;
    
    while (node) {
      const nodeLength = node.textContent?.length || 0;
      
      if (currentOffset + nodeLength >= offset) {
        return { node, offset: offset - currentOffset };
      }
      
      currentOffset += nodeLength;
      node = walker.nextNode() as Text;
    }
    
    // If offset is beyond text, return the last text node
    if (node) {
      return { node, offset: node.textContent?.length || 0 };
    }
    
    return null;
  };

  // Helper function to select text range
  const selectTextRange = (container: Element, start: number, end: number) => {
    const startNode = getTextNodeAtOffset(container, start);
    const endNode = getTextNodeAtOffset(container, end);
    
    if (startNode && endNode) {
      const selection = window.getSelection();
      const range = document.createRange();
      
      try {
        range.setStart(startNode.node, startNode.offset);
        range.setEnd(endNode.node, endNode.offset);
        
        selection?.removeAllRanges();
        selection?.addRange(range);
        
      } catch (error) {
        // Silently handle text selection errors
      }
    }
  };

  // Update highlights when insights change
  useEffect(() => {
    const timer = setTimeout(renderHighlights, 50);
    return () => clearTimeout(timer);
  }, [renderHighlights]);

  // Initialize undo manager with initial content
  useEffect(() => {
    if (content && undoRedoManager.canUndo() === false) {
      undoRedoManager.saveState(content);
    }
  }, [content, undoRedoManager]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Undo/Redo shortcuts
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      handleUndo();
      return;
    }
    
    if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      handleRedo();
      return;
    }

    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      
      const activeInsights = insights.filter(i => !i.isStale);
      if (activeInsights.length === 0) return;
      
      const currentIndex = selectedInsight 
        ? activeInsights.findIndex(i => i.id === selectedInsight.id)
        : -1;
      
      let newIndex;
      if (e.key === 'ArrowDown') {
        newIndex = currentIndex < activeInsights.length - 1 ? currentIndex + 1 : 0;
      } else {
        newIndex = currentIndex > 0 ? currentIndex - 1 : activeInsights.length - 1;
      }
      
      const nextInsight = activeInsights[newIndex];
      onInsightSelect?.(nextInsight);
      // Just scroll to insight without selecting text to avoid corner jumping
      const element = document.querySelector(`[data-ins="${nextInsight.id}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [insights, selectedInsight, onInsightSelect, handleUndo, handleRedo]);

  return (
    <div className="relative bg-white border rounded-lg">
      {/* Undo/Redo toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200">
        <button
          onClick={handleUndo}
          disabled={!undoRedoManager.canUndo()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="ביטול (Ctrl+Z)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          ביטול
        </button>
        <button
          onClick={handleRedo}
          disabled={!undoRedoManager.canRedo()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          title="חזרה (Ctrl+Y)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
          </svg>
          חזרה
        </button>
      </div>

      <div
        ref={editorRef}
        className="relative min-h-[60vh] p-6 outline-none overflow-y-auto"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => setIsComposing(false)}
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.6',
          fontSize: '16px',
          fontFamily: 'inherit',
          direction: 'rtl'
        }}
        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br>') }}
      />
      
      {/* Stale insights indicator */}
      {AnchorManager.getStalePercentage(insights) > 10 && (
        <div className="absolute top-2 left-2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-2 py-1 rounded text-xs">
          חלק מההדגשות דורשות עדכון - יש לסרוק מחדש
        </div>
      )}
      
      {/* Enhanced Multi-Quote Tooltip (if enabled) */}
      {import.meta.env.VITE_ENABLE_HOVER_TOOLTIPS === 'true' && hoveredGroup && tooltipPosition && (
        <QuoteTooltip
          insights={hoveredGroup.insights}
          quotes={hoveredGroup.quotes}
          position={tooltipPosition}
          criteria={criteria}
          onClose={() => {
            setHoveredGroup(null);
            setTooltipPosition(null);
          }}
        />
      )}
      
      {/* Insight Panel - Shows on left when highlight is clicked */}
      {clickedGroup && (
        <InsightPanel
          insights={clickedGroup.insights}
          quotes={clickedGroup.quotes}
          criteria={criteria}
          onClose={() => setClickedGroup(null)}
          initialPosition={{ x: 20, y: 100 }}
        />
      )}
      
      {/* Fallback: Old Insight Hover Tooltip for single insights without groups */}
      {!hoveredGroup && hoveredInsight && tooltipPosition && (
        <div
          className="fixed z-50 bg-gray-900 text-white p-4 rounded-lg shadow-2xl max-w-md pointer-events-none"
          style={{
            left: `${Math.min(tooltipPosition.x + 10, window.innerWidth - 450)}px`,
            top: `${Math.max(10, Math.min(tooltipPosition.y, window.innerHeight - 400))}px`
          }}
        >
          {/* Criterion header with color indicator */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span 
                className="inline-block w-3 h-3 rounded-full"
                style={{ 
                  background: `hsl(var(${CRITERIA_MAP[hoveredInsight.criterionId]?.colorVar || '--crit-timeline'}))` 
                }}
              />
              <div className="text-sm font-bold">
                {CRITERIA_MAP[hoveredInsight.criterionId]?.name || 'תובנה'}
              </div>
            </div>
            {/* Criterion Score */}
            {(() => {
              console.log('Tooltip Debug:', { 
                criterionId: hoveredInsight.criterionId, 
                criteriaCount: criteria.length,
                criteria: criteria.map(c => ({ id: c.id, score: c.score }))
              });
              const criterionScore = criteria.find(c => c.id === hoveredInsight.criterionId);
              if (criterionScore) {
                const scoreColor = criterionScore.score >= 4 ? 'text-green-400' : 
                                 criterionScore.score >= 2 ? 'text-yellow-400' : 'text-red-400';
                return (
                  <div className={`text-xs font-bold ${scoreColor} bg-gray-800 px-2 py-1 rounded`}>
                    {criterionScore.score}/5
                  </div>
                );
              }
              return null;
            })()}
          </div>
          
          {/* Quote if available */}
          {hoveredInsight.quote && (
            <div className="text-xs opacity-80 mb-2 italic border-r-2 border-gray-600 pr-2">
              "{hoveredInsight.quote}"
            </div>
          )}
          
          {/* Full explanation */}
          {hoveredInsight.explanation && (
            <div className="text-xs opacity-90 mb-2">
              <div className="font-semibold mb-1">הסבר:</div>
              {hoveredInsight.explanation}
            </div>
          )}
          
          {/* Primary suggestion */}
          {hoveredInsight.suggestion_primary && (
            <div className="text-xs opacity-90 mb-2">
              <div className="font-semibold mb-1">המלצה ראשית:</div>
              {hoveredInsight.suggestion_primary}
            </div>
          )}
          
          {/* Secondary suggestion */}
          {hoveredInsight.suggestion_secondary && (
            <div className="text-xs opacity-80 mb-2">
              <div className="font-semibold mb-1">המלצה משנית:</div>
              {hoveredInsight.suggestion_secondary}
            </div>
          )}
          
          {/* Severity indicator */}
          {hoveredInsight.severity && (
            <div className="text-xs mt-2 pt-2 border-t border-gray-700">
              <span className="opacity-70">חומרה: </span>
              <span className={`font-semibold ${
                hoveredInsight.severity === 'critical' ? 'text-red-400' :
                hoveredInsight.severity === 'moderate' ? 'text-yellow-400' :
                'text-green-400'
              }`}>
                {hoveredInsight.severity === 'critical' ? 'קריטי' :
                 hoveredInsight.severity === 'moderate' ? 'בינוני' : 'נמוך'}
              </span>
            </div>
          )}
          
          <div className="text-xs opacity-60 mt-2 text-center border-t border-gray-700 pt-2">
            לחץ לפרטים מלאים ועריכה
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionEditor;
