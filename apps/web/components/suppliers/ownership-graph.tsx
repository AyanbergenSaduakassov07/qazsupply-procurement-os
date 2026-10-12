"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";

import { BuildingIcon, UserIcon } from "../shell/icons";

export interface GraphNode {
  id: string;
  kind: "company" | "person";
  name: string;
  country: string | null;
  birth_year: number | null;
  depth: number;
  flagged: boolean;
}
export interface GraphEdge {
  owner_id: string;
  owned_id: string;
  role: string;
  share_pct: string | null;
}

const COL_W = 260;
const NODE_W = 220;
const ROW_H = 56;
const NODE_H = 44;

/**
 * Layered ownership graph: the supplier on the left, each column one step further up the chain.
 * Nodes are real buttons (screen readers and keyboards reach them); edges are a decorative SVG.
 * Keys: Up/Down within a column, Left/Right to the nearest node of the next column, Enter selects.
 * ponytail: plain layered layout without crossing reduction; fine for tens of parties per column.
 */
export function OwnershipGraph({
  nodes,
  edges,
  label,
  help,
  roleNames,
  flaggedLabel,
  bornLabel,
  onSelect,
  selected,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  label: string;
  help: string;
  roleNames: Record<string, string>;
  flaggedLabel: string;
  bornLabel: string;
  onSelect: (id: string) => void;
  selected: string | null;
}) {
  const columns = useMemo(() => {
    const cols: GraphNode[][] = [];
    for (const n of nodes) {
      cols[n.depth] = [...(cols[n.depth] ?? []), n];
    }
    return cols.map((c) => c ?? []);
  }, [nodes]);
  const pos = useMemo(() => {
    const p = new Map<string, { x: number; y: number; col: number; row: number }>();
    for (const [ci, col] of columns.entries()) {
      for (const [ri, n] of col.entries())
        p.set(n.id, { x: ci * COL_W, y: ri * ROW_H, col: ci, row: ri });
    }
    return p;
  }, [columns]);
  const [focus, setFocus] = useState(nodes[0]?.id ?? "");
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const height = Math.max(...columns.map((c) => c.length), 1) * ROW_H;
  const width = Math.max(columns.length, 1) * COL_W;

  const move = (id: string | undefined) => {
    if (!id) return;
    setFocus(id);
    refs.current.get(id)?.focus();
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const p = pos.get(id);
    if (!p) return;
    const col = columns[p.col] ?? [];
    const nearest = (ci: number) => {
      const target = columns[ci];
      if (!target?.length) return undefined;
      return target[Math.min(p.row, target.length - 1)]?.id;
    };
    const keys: Record<string, () => string | undefined> = {
      ArrowDown: () => col[p.row + 1]?.id,
      ArrowUp: () => col[p.row - 1]?.id,
      ArrowRight: () => nearest(p.col + 1),
      ArrowLeft: () => nearest(p.col - 1),
      Home: () => nodes[0]?.id,
    };
    const go = keys[e.key];
    if (!go) return;
    e.preventDefault();
    move(go());
  };

  return (
    <div>
      <p id="graph-help" className="mb-2 text-xs text-muted">
        {help}
      </p>
      <div className="max-h-[560px] overflow-auto rounded-[var(--qs-radius-md)] border border-line">
        <fieldset
          aria-describedby="graph-help"
          className="relative m-0 min-w-0 border-0 p-0"
          style={{ width, height }}
        >
          <legend className="sr-only">{label}</legend>
          <svg aria-hidden="true" className="absolute inset-0" width={width} height={height}>
            {edges.map((e) => {
              const a = pos.get(e.owned_id);
              const b = pos.get(e.owner_id);
              if (!a || !b) return null;
              const [x1, y1] = [a.x + NODE_W + 12, a.y + NODE_H / 2 + 6];
              const [x2, y2] = [b.x + 12, b.y + NODE_H / 2 + 6];
              const mid = (x1 + x2) / 2;
              return (
                <path
                  key={`${e.owner_id}-${e.owned_id}-${e.role}`}
                  d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--qs-line-strong, currentColor)"
                  strokeOpacity={0.5}
                  strokeDasharray={e.role === "beneficial_owner" ? "4 3" : undefined}
                />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = pos.get(n.id);
            if (!p) return null;
            const roles = edges
              .filter((e) => e.owner_id === n.id)
              .map(
                (e) =>
                  `${roleNames[e.role] ?? e.role}${e.share_pct ? ` ${Number(e.share_pct)}%` : ""}`,
              );
            const extra = [
              n.birth_year ? bornLabel.replace("{year}", String(n.birth_year)) : null,
              n.country,
              ...new Set(roles),
              n.flagged ? flaggedLabel : null,
            ].filter(Boolean);
            return (
              <button
                key={n.id}
                ref={(el) => {
                  if (el) refs.current.set(n.id, el);
                }}
                type="button"
                data-testid="graph-node"
                tabIndex={n.id === focus ? 0 : -1}
                aria-pressed={selected === n.id}
                onFocus={() => setFocus(n.id)}
                onKeyDown={(e) => onKey(e, n.id)}
                onClick={() => onSelect(n.id)}
                aria-label={`${n.name}${extra.length ? `, ${extra.join(", ")}` : ""}`}
                title={n.name}
                className={`absolute flex items-center gap-2 overflow-hidden rounded-[var(--qs-radius-md)] border bg-surface px-2 text-left text-xs text-ink outline-none focus-visible:outline-2 focus-visible:outline-[var(--qs-focus)] ${
                  n.flagged
                    ? "border-risk"
                    : selected === n.id
                      ? "border-[var(--qs-focus)]"
                      : "border-line"
                }`}
                style={{ left: p.x + 12, top: p.y + 6, width: NODE_W, height: NODE_H }}
              >
                <span className="shrink-0 text-muted">
                  {n.kind === "company" ? <BuildingIcon width={16} /> : <UserIcon width={16} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{n.name}</span>
                {n.flagged && (
                  <span aria-hidden="true" className="shrink-0 font-semibold text-risk">
                    !
                  </span>
                )}
              </button>
            );
          })}
        </fieldset>
      </div>
    </div>
  );
}
