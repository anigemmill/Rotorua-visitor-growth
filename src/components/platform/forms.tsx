"use client";

// Forms backed by server actions. Validation happens on the server; these
// components only display the result. Submission goes through a transition
// (not the native form action) so a failed validation doesn't wipe what the
// user typed.

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import type { ActionState, FormAction } from "@/lib/web/types";

const FormState = createContext<{ state: ActionState; pending: boolean }>({ state: null, pending: false });

export function ActionForm({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
  confirm,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  /** Ask the user to confirm before submitting (destructive actions). */
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <FormState value={{ state, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (confirm && !window.confirm(confirm)) return;
          const data = new FormData(e.currentTarget);
          startTransition(() => formAction(data));
        }}
      >
        {children}
      </form>
    </FormState>
  );
}

export function FormStatus() {
  const { state } = useContext(FormState);
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p role="status" className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
        {state.message}
      </p>
    );
  }
  return null;
}

const inputClass =
  "w-full rounded-md border border-black/15 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 aria-[invalid=true]:border-red-500";

export function Field({
  name,
  label,
  hint,
  type = "text",
  defaultValue,
  required,
  multiline,
  rows = 3,
  placeholder,
  autoComplete,
  options,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  autoComplete?: string;
  options?: { value: string; label: string }[];
}) {
  const { state } = useContext(FormState);
  const errors = state?.fieldErrors?.[name];
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, errors ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id,
    name,
    defaultValue: defaultValue ?? undefined,
    required,
    placeholder,
    autoComplete,
    "aria-invalid": errors ? true : undefined,
    "aria-describedby": describedBy,
    className: inputClass,
  };

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {!required && <span className="ml-1 font-normal text-black/40 dark:text-white/40">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="mt-0.5 text-xs text-black/55 dark:text-white/55">
          {hint}
        </p>
      )}
      <div className="mt-1.5">
        {options ? (
          <select {...common}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : multiline ? (
          <textarea {...common} rows={rows} />
        ) : (
          <input {...common} type={type} />
        )}
      </div>
      {errors && (
        <p id={`${id}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "danger" | "secondary" }) {
  const { pending } = useContext(FormState);
  const styles = {
    primary: "bg-teal-700 text-white hover:bg-teal-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
    secondary: "border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${styles}`}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
