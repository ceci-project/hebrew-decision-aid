import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Insight } from '@/types/models';
import { CRITERIA_MAP } from '@/data/criteria';
import { AnchorManager } from '@/services/anchorManager';
import { UndoRedoManager } from '@/services/undoRedoManager';

interface Props {
  content: string;
  insights: Insight[];
  onContentChange: (content: string) => void;
  onInsightsChange: (insights: Insight[]) => void;
  onInsightSelect?: (insight: Insight | null) => void;
  selectedInsight?: Insight | null;
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
  selectedInsight
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [highlightSpans, setHighlightSpans] = useState<HighlightSpan[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [undoRedoManager] = useState(() => new UndoRedoManager());
  const updateTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCaretPositionRef = useRef<number>(0);
  const highlightUpdateTimeoutRef = useRef<NodeJS.Timeout>();

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
          console.warn('Error restoring cursor position:', error);
        }
        break;
      }
      
      currentOffset += nodeLength;
      node = walker.nextNode() as Text;
    }
  }, []);

  // Improved debounced update function
  const debouncedUpdate = useCallback((newContent: string) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      onContentChange(newContent);
      undoRedoManager.saveState(newContent);
    }, 100); // Reduced delay for better responsiveness
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

  // Improved highlight rendering with better performance
  const renderHighlights = useCallback(() => {
    if (!editorRef.current) return;

    // Clear existing timeout
    if (highlightUpdateTimeoutRef.current) {
      clearTimeout(highlightUpdateTimeoutRef.current);
    }

    highlightUpdateTimeoutRef.current = setTimeout(() => {
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

      sortedInsights.forEach(insight => {
        const start = Math.max(0, Math.min(insight.rangeStart, textContent.length));
        const end = Math.max(start, Math.min(insight.rangeEnd, textContent.length));
        
        if (start < end && end <= textContent.length) {
          spans.push({ start, end, insight });
        }
      });

      setHighlightSpans(spans);
      
      // Apply visual highlights with improved positioning
      requestAnimationFrame(() => {
        if (!editorRef.current) return;
        
        spans.forEach(span => {
          const range = document.createRange();
          const textNode = getTextNodeAtOffset(editor, span.start);
          const endTextNode = getTextNodeAtOffset(editor, span.end);
          
          if (textNode && endTextNode) {
            try {
              range.setStart(textNode.node, Math.min(textNode.offset, textNode.node.textContent?.length || 0));
              range.setEnd(endTextNode.node, Math.min(endTextNode.offset, endTextNode.node.textContent?.length || 0));
              
              const rects = range.getClientRects();
              if (rects.length > 0) {
                const editorRect = editor.getBoundingClientRect();
                
                // Create highlight for each rect (handles multi-line selections)
                Array.from(rects).forEach((rect, index) => {
                  if (rect.width > 0 && rect.height > 0) {
                    const highlight = document.createElement('div');
                    highlight.className = `insight-highlight absolute pointer-events-auto cursor-pointer rounded-sm transition-all duration-150 ${
                      selectedInsight?.id === span.insight.id ? 'ring-2 ring-blue-500/50 z-20' : 'z-10'
                    }`;
                    
                    const criterion = CRITERIA_MAP[span.insight.criterionId] || { colorVar: '--crit-timeline' };
                    highlight.style.cssText = `
                      left: ${rect.left - editorRect.left + editor.scrollLeft}px;
                      top: ${rect.top - editorRect.top + editor.scrollTop}px;
                      width: ${rect.width}px;
                      height: ${rect.height}px;
                      background: hsl(var(${criterion.colorVar}) / 0.25);
                      border: 1px solid hsl(var(${criterion.colorVar}) / 0.6);
                    `;
                    
                    highlight.addEventListener('click', (e) => {
                      e.stopPropagation();
                      onInsightSelect?.(span.insight);
                      selectTextRange(editor, span.start, span.end);
                    });
                    
                    highlight.addEventListener('mouseenter', () => {
                      highlight.style.background = `hsl(var(${criterion.colorVar}) / 0.4)`;
                    });
                    
                    highlight.addEventListener('mouseleave', () => {
                      highlight.style.background = `hsl(var(${criterion.colorVar}) / 0.25)`;
                    });
                    
                    editor.appendChild(highlight);
                    if (index === 0) span.element = highlight;
                  }
                });
              }
            } catch (error) {
              console.warn('Error creating highlight range:', error);
            }
          }
        });
        
        // Restore cursor position after highlighting
        restoreCursorPosition();
      });
    }, 50); // Small delay to batch updates
  }, [insights, selectedInsight, onInsightSelect, restoreCursorPosition]);

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
        console.warn('Error selecting text range:', error);
      }
    }
  };

  // Update highlights when insights change or on scroll
  useEffect(() => {
    renderHighlights();
  }, [renderHighlights]);

  // Add scroll listener to update highlights on scroll
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleScroll = () => {
      renderHighlights();
    };

    editor.addEventListener('scroll', handleScroll, { passive: true });
    return () => editor.removeEventListener('scroll', handleScroll);
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
      selectTextRange(editorRef.current!, nextInsight.rangeStart, nextInsight.rangeEnd);
    }
  }, [insights, selectedInsight, onInsightSelect, handleUndo, handleRedo]);

  return (
    <div className="relative bg-white border rounded-lg">
      {/* Undo/Redo toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200">
        <button
          onClick={handleUndo}
          disabled={!undoRedoManager.canUndo()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
    </div>
  );
};

export default DecisionEditor;
