"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { AlertIcon } from "@/components/icons";

// Retro booth system: ink solid primary, single red accent for the shutter
// moment, hairline borders, soft layered shadows.
type Tone = "ink" | "accent";

export function Btn({
  children,
  className = "",
  tone = "ink",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const toneCls =
    tone === "accent"
      ? "bg-booth-accent text-white hover:bg-booth-accent-deep active:bg-booth-accent-deep shadow-[0_2px_8px_-1px_rgba(15,23,42,0.25)] disabled:bg-booth-line/70 disabled:text-booth-muted disabled:shadow-none dark:disabled:bg-booth-nightline dark:disabled:text-booth-creamdim"
      : "bg-booth-ink text-booth-paper hover:bg-black active:bg-black dark:bg-booth-cream dark:text-booth-night dark:hover:bg-white shadow-[0_2px_6px_rgba(23,19,16,0.2)] disabled:bg-booth-line/70 disabled:text-booth-muted disabled:shadow-none dark:disabled:bg-booth-nightline dark:disabled:text-booth-creamdim";
  return (
    <button
      {...rest}
      className={`font-sans flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold tracking-wide transition active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:shadow-none ${toneCls} ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostBtn({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`font-sans flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-booth-line bg-booth-card/80 px-5 py-3 text-sm font-semibold text-booth-ink transition hover:bg-black/[0.04] hover:border-booth-ink/20 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 dark:border-booth-nightline dark:bg-booth-nightcard/80 dark:text-booth-cream dark:hover:bg-white/[0.06] ${className}`}
    >
      {children}
    </button>
  );
}

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-booth-line bg-booth-card px-4 py-3 text-sm font-semibold text-booth-ink outline-none placeholder:font-normal placeholder:text-booth-muted/70 focus:border-booth-accent focus:ring-2 focus:ring-booth-accent/20 transition dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream ${props.className ?? ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`booth-card w-full rounded-2xl p-5 md:p-6 ${className}`}>{children}</div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
    >
      <AlertIcon size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
      <span className="leading-snug">{msg}</span>
    </p>
  );
}

export function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-booth-muted dark:text-booth-creamdim">
      <span
        aria-hidden
        className={`inline-flex h-2 w-2 rounded-full ${on ? "bg-emerald-600 dark:bg-emerald-400" : "bg-booth-muted/40 dark:bg-booth-creamdim/40"}`}
      />
      {label}
    </span>
  );
}

export function StepBadge({ step, of, label }: { step: string; of: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-booth-muted tabular-nums dark:text-booth-creamdim">
        Langkah {step}/{of}
      </span>
      <span aria-hidden className="h-3 w-px self-center bg-booth-line dark:bg-booth-nightline" />
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-booth-ink dark:text-booth-cream">
        {label}
      </span>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div
      role={label ? "group" : undefined}
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-booth-line bg-black/[0.04] p-1 dark:border-booth-nightline dark:bg-white/[0.05]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`font-sans min-h-[40px] rounded-lg px-3 py-2 text-xs font-semibold tracking-wide transition ${
              active
                ? "bg-booth-ink text-booth-paper shadow-sm dark:bg-booth-cream dark:text-booth-night"
                : "text-booth-muted hover:text-booth-ink dark:text-booth-creamdim dark:hover:text-booth-cream"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function IconBtn({
  children,
  label,
  className = "",
  variant = "outline",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "outline" | "overvideo";
}) {
  const variantCls =
    variant === "overvideo"
      ? "border-transparent bg-black/70 text-white hover:bg-black/85 active:bg-black"
      : "border-booth-line bg-booth-card text-booth-ink hover:bg-black/[0.04] hover:border-booth-ink/20 dark:border-booth-nightline dark:bg-booth-nightcard dark:text-booth-cream dark:hover:bg-white/[0.06]";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={`flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
}
