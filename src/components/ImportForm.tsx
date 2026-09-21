"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TARGETS = [
  { value: "VisitorMetric", label: "Visitor metrics", columns: "metric, value, unit, originMarket, isInternational, visitorPurpose" },
  { value: "AccommodationMetric", label: "Accommodation metrics", columns: "metric, value, unit, accommodationType" },
  { value: "DemandSignal", label: "Demand signals", columns: "signalType, topic, value, unit" },
];

const CONFIDENCE_OPTIONS = ["VERIFIED", "HIGH", "MEDIUM", "LOW", "MODELLED"];
const ACCESS_OPTIONS = ["PUBLIC", "PARTNER", "PRIVATE_BUSINESS", "AGGREGATED", "MODEL_INFERENCE"];

export function ImportForm({ onImported }: { onImported?: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [target, setTarget] = useState(TARGETS[0].value);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(
        `Imported ${data.rowCount} row(s)${data.rejectedCount ? `, rejected ${data.rejectedCount}` : ""}.`
      );
      formRef.current?.reset();
      router.refresh();
      onImported?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  const selected = TARGETS.find((t) => t.value === target)!;

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3 text-sm">
      <div>
        <label className="block mb-1 font-medium">Target table</label>
        <select
          name="targetTable"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-2 py-1.5"
        >
          {TARGETS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">CSV columns: {selected.columns}</p>
      </div>

      <div>
        <label className="block mb-1 font-medium">CSV file</label>
        <input
          type="file"
          name="file"
          accept=".csv,text/csv"
          required
          className="w-full text-xs"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field name="dataSourceName" label="Source name" placeholder="e.g. RotoruaNZ Visitor Spend Report" />
        <Field name="dataSourceOrganisation" label="Source organisation" placeholder="e.g. RotoruaNZ" />
        <Field name="geography" label="Geography" placeholder="e.g. Rotorua District" />
        <div>
          <label className="block mb-1 font-medium">Confidence</label>
          <select name="confidence" className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-2 py-1.5">
            {CONFIDENCE_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block mb-1 font-medium">Access level</label>
          <select name="accessLevel" className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-2 py-1.5">
            {ACCESS_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <Field name="periodStart" label="Period start" type="date" />
        <Field name="periodEnd" label="Period end" type="date" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Importing…" : "Import"}
      </button>

      {result && <p className="text-emerald-700 dark:text-emerald-400">{result}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block mb-1 font-medium">{label}</label>
      <input
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-2 py-1.5"
      />
    </div>
  );
}
