"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AIDiscoveryRunButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ai-discovery/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to run");
      if (data.skipped) {
        setMessage(data.reason);
      } else {
        setMessage(`Ran ${data.ranChecks} prompt check(s).`);
        router.refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to run");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Running…" : "Run AI Discovery now"}
      </button>
      {message && <p className="text-sm text-black/70 dark:text-white/70">{message}</p>}
    </div>
  );
}
