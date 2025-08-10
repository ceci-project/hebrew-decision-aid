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
    if (ins.rangeStart > cursor) {
      nodes.push(
        <span key={`t-${cursor}`}>{content.slice(cursor, ins.rangeStart)}</span>
      );
    }

    const crit = CRITERIA_MAP[ins.criterionId];
    const spanId = `hl-${ins.id}`;

    nodes.push(
      <mark
        id={spanId}
        key={ins.id}
        className="rounded-sm px-0.5 py-0.5"
        style={{
          background: `hsl(var(${crit.colorVar}))`,
          color: "inherit",
        }}
        title={`${crit.name}: ${ins.explanation}`}
      >
        {content.slice(ins.rangeStart, ins.rangeEnd)}
      </mark>
    );
    cursor = ins.rangeEnd;
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
