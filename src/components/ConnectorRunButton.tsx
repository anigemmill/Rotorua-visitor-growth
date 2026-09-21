"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ConnectorResult {
  connector: string;
  ok: boolean;
  rowsWritten: number;
  error?: string;
}

export function ConnectorRunButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<ConnectorResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/connectors/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to run connectors");
      setResults(data.results);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run connectors");
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
        {pending ? "Running connectors…" : "Run weather & holiday connectors now"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {results && (
        <ul className="text-sm space-y-1">
          {results.map((r) => (
            <li key={r.connector}>
              <span className="font-medium">{r.connector}</span>:{" "}
              {r.ok ? `OK — ${r.rowsWritten} row(s) written` : `Failed — ${r.error}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
