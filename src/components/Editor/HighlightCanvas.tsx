import React from "react";
import { Insight } from "@/types/models";
import { CRITERIA_MAP } from "@/data/criteria";

interface Props {
  content: string;
  insights: Insight[];
}

export const HighlightCanvas: React.FC<Props> = ({ content, insights }) => {
  // Build highlighted content segments (assumes minimal overlap)
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  const ordered = [...insights].sort((a, b) => a.rangeStart - b.rangeStart);

  for (const ins of ordered) {
    const originalStart = Math.max(0, Math.min(ins.rangeStart ?? 0, content.length));
    const originalEnd = Math.max(originalStart, Math.min(ins.rangeEnd ?? originalStart, content.length));

    // Try to fix invalid or tiny ranges by matching the quote
    let start = originalStart;
    let end = originalEnd;
    if (end <= start || end - start < 1) {
      if (ins.quote) {
        const idx = content.indexOf(ins.quote);
        if (idx >= 0) {
          start = idx;
          end = idx + ins.quote.length;
        }
      }
    }

    // Prevent overlapping duplication in rendering
    const displayStart = Math.max(start, cursor);
    const displayEnd = Math.max(displayStart, end);

    if (displayStart > cursor) {
      nodes.push(
        <span key={`t-${cursor}`}>{content.slice(cursor, displayStart)}</span>
      );
    }

    const crit = CRITERIA_MAP[ins.criterionId] || ({ colorVar: "--crit-fallback", name: "" } as any);
    const spanId = `hl-${ins.criterionId}-${ins.id}`;

    nodes.push(
      <mark
        id={spanId}
        key={ins.id}
        data-crit={ins.criterionId}
        data-ins={ins.id}
        data-start={start}
        data-end={end}
        className="rounded-sm px-0.5 py-0.5 scroll-mt-24"
        style={{
          background: `hsl(var(${crit.colorVar}))`,
          color: "inherit",
        }}
        title={`${crit.name}: ${ins.explanation}`}
      >
        {content.slice(displayStart, displayEnd)}
      </mark>
    );
    cursor = displayEnd;
  }

  if (cursor < content.length) {
    nodes.push(<span key={`t-end`}>{content.slice(cursor)}</span>);
  }

  return (
    <article className="max-w-none leading-relaxed">
      <div dir="rtl" className="whitespace-pre-wrap break-words">{nodes}</div>
    </article>
  );
};

export default HighlightCanvas;
