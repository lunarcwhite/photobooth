"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

// Playful pop system: gradient pink→fuchsia primary, chunky radius,
// hard offset shadow, active press. Satu tempat untuk seluruh app.
export function Btn({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`font-display w-full rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-fuchsia-500 px-5 py-3.5 text-lg tracking-wide text-white shadow-[0_4px_0_#9d174d] transition hover:brightness-110 active:translate-y-[3px] active:shadow-none disabled:opacity-50 disabled:shadow-none ${className}`}
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
      className={`font-display w-full rounded-2xl border-2 border-violet-300 bg-white/80 px-5 py-3 text-base text-violet-700 shadow-[0_3px_0_#c4b5fd] transition hover:bg-white active:translate-y-[2px] active:shadow-none disabled:opacity-50 disabled:shadow-none dark:border-violet-700 dark:bg-white/10 dark:text-violet-200 dark:shadow-[0_3px_0_#4c1d95] ${className}`}
    >
      {children}
    </button>
  );
}

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border-2 border-pink-200 bg-white px-4 py-3 text-base font-semibold outline-none placeholder:font-normal placeholder:text-zinc-400 focus:border-pink-500 focus:ring-4 focus:ring-pink-200/60 dark:border-pink-900 dark:bg-zinc-900 dark:focus:border-pink-400 ${props.className ?? ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-full rounded-3xl border-2 border-white bg-white/85 p-5 shadow-[0_6px_24px_-8px_rgba(219,39,119,0.35)] backdrop-blur dark:border-white/10 dark:bg-zinc-900/85 ${className}`}
    >
      {children}
    </div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="pop-in rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {msg}
    </p>
  );
}

export function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
      <span className="relative flex h-2.5 w-2.5">
        {on && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${on ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
        />
      </span>
      {label}
    </span>
  );
}

export function StepBadge({ step, of, label }: { step: string; of: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-display rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-3 py-1 text-xs font-bold text-white shadow-[0_2px_0_#b45309]">
        {step}/{of}
      </span>
      <span className="text-xs font-bold uppercase tracking-widest text-pink-600 dark:text-pink-300">{label}</span>
    </div>
  );
}
