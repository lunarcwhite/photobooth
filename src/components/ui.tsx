"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Btn({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`w-full rounded-2xl bg-zinc-900 px-5 py-3.5 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 ${className}`}
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
      className={`w-full rounded-2xl border border-zinc-300 px-5 py-3 text-base font-medium transition active:scale-[0.99] disabled:opacity-50 dark:border-zinc-700 ${className}`}
    >
      {children}
    </button>
  );
}

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus:border-zinc-300 ${props.className ?? ""}`}
    />
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="w-full rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {children}
    </div>
  );
}

export function ErrorMsg({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {msg}
    </p>
  );
}

export function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${on ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"}`}
      />
      {label}
    </span>
  );
}
