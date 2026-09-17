"use client";

import { memo } from "react";
import { LIVE_FILTERS, type LiveFilterId } from "@/lib/filter/types";
import { ClockIcon } from "@/components/icons";

interface LiveFilterSelectorProps {
  activeFilter: LiveFilterId;
  onChange: (id: LiveFilterId) => void;
  isLoading?: boolean;
  loadingMessage?: string | null;
  className?: string;
}

export const LiveFilterSelector = memo(function LiveFilterSelector({
  activeFilter,
  onChange,
  isLoading = false,
  loadingMessage,
  className = "",
}: LiveFilterSelectorProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-booth-muted dark:text-booth-creamdim flex items-center gap-1.5">
          <span>✨</span>
          <span>Live Filter AR</span>
        </span>
        {isLoading ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-booth-accent animate-pulse">
            <ClockIcon size={12} className="animate-spin" />
            <span>{loadingMessage ?? "Memuat AI…"}</span>
          </span>
        ) : (
          <span className="text-[10px] font-medium text-booth-accent">
            {LIVE_FILTERS.find((f) => f.id === activeFilter)?.name}
          </span>
        )}
      </div>

      {/* Horizontal pill list */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-booth-line/60 dark:border-booth-nightline/60 scrollbar-none">
        {LIVE_FILTERS.map((f) => {
          const isActive = f.id === activeFilter;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              title={f.desc}
              className={`group relative flex shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 ${
                isActive
                  ? "bg-booth-accent text-white shadow-sm ring-2 ring-booth-accent/30"
                  : "bg-white/80 dark:bg-black/40 text-booth-ink dark:text-booth-cream hover:bg-white dark:hover:bg-black/60 border border-booth-line/40 dark:border-booth-nightline/40"
              }`}
            >
              <span className="text-sm select-none transition-transform duration-150 group-hover:scale-110">
                {f.icon}
              </span>
              <span className="text-[11px] whitespace-nowrap">
                {f.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
});
