"use client";

// Wraps a server action with useActionState so validation and permission
// errors render inline instead of crashing to an error page.

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/forms";
import { buttonClass, cx } from "./primitives";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  className,
  resetOnSuccess = false,
  inline = false,
  variant = "primary",
  confirm,
}: {
  action: Action;
  children?: ReactNode;
  submitLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  inline?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={cx(inline ? "flex flex-wrap items-end gap-2" : "space-y-5", className)}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className={cx("flex flex-wrap items-center gap-3", inline && "contents")}>
        <Submit label={submitLabel} variant={variant} small={inline} />
        <div aria-live="polite" className="text-sm">
          {state?.error && <span className="text-danger">{state.error}</span>}
          {state?.ok && <span className="text-success">{state.ok}</span>}
        </div>
      </div>
    </form>
  );
}

function Submit({ label, variant, small }: { label: string; variant: "primary" | "secondary" | "danger" | "ghost"; small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, small ? "sm" : "md")}>
      {pending ? "Saving…" : label}
    </button>
  );
}
