"use client";

import { type ReactNode, useMemo, useState } from "react";

import { cn } from "../lib/utils";

export interface Column<T> {
  id: string;
  header: string;
  /** Right-align numbers and use tabular figures. */
  numeric?: boolean;
  cell: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sortValue?: (row: T) => number | string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  caption: string;
  emptyLabel: string;
  initialSort?: { id: string; direction: "asc" | "desc" };
  className?: string;
}

/** Analytics table: semantic markup, keyboard-sortable headers, aria-sort. */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  caption,
  emptyLabel,
  initialSort,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = useState(initialSort);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.id === sort.id);
    if (!column?.sortValue) return rows;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.sortValue?.(a) ?? "";
      const vb = column.sortValue?.(b) ?? "";
      if (va === vb) return 0;
      return va > vb ? factor : -factor;
    });
  }, [rows, sort, columns]);

  const toggle = (column: Column<T>) => {
    if (!column.sortValue) return;
    setSort((current) =>
      current?.id === column.id
        ? { id: column.id, direction: current.direction === "asc" ? "desc" : "asc" }
        : { id: column.id, direction: "asc" },
    );
  };

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-[var(--qs-card-radius)] border border-line",
        className,
      )}
    >
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface-raised">
          <tr>
            {columns.map((column) => {
              const active = sort?.id === column.id;
              const ariaSort = !column.sortValue
                ? undefined
                : active
                  ? sort?.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort}
                  className={cn(
                    "px-4 py-2 text-xs font-medium text-muted",
                    column.numeric && "text-right",
                  )}
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggle(column)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-[var(--qs-radius-sm)]",
                        "hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qs-focus)]",
                        active && "text-ink",
                      )}
                    >
                      {column.header}
                      <span aria-hidden="true" className={active ? "" : "opacity-40"}>
                        {active && sort?.direction === "desc" ? "▾" : "▴"}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={getRowId(row)} className="border-line border-t">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={cn(
                      "px-4 py-2 text-ink",
                      column.numeric && "text-right tabular-nums",
                    )}
                  >
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
