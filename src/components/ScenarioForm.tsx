"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ScenarioAnswer {
  facts: string[];
  evidence: string[];
  inferences: string[];
  hypotheses: string[];
  recommendations: string[];
  insufficientData: string[];
  llmAssisted: boolean;
}

const EXAMPLES = [
  "What could increase winter visitation?",
  "What could encourage visitors to stay another night?",
  "What experiences are under-discovered?",
  "What could increase visitor spend?",
];

export function ScenarioForm() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<ScenarioAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    setPending(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to answer");
      setAnswer(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to answer");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
        className="space-y-2"
      >
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What could increase winter visitation?"
          rows={2}
          className="w-full rounded border border-black/15 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="rounded-md bg-black text-white dark:bg-white dark:text-black px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "Thinking…" : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQuestion(ex);
              ask(ex);
            }}
            className="text-xs rounded-full border border-black/15 dark:border-white/15 px-2.5 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {answer && (
        <div className="space-y-3 text-sm">
          <AnswerSection label="FACT" items={answer.facts} />
          <AnswerSection label="EVIDENCE" items={answer.evidence} />
          <AnswerSection label="INFERENCE" items={answer.inferences} />
          <AnswerSection label="HYPOTHESIS" items={answer.hypotheses} />
          <AnswerSection label="RECOMMENDATION" items={answer.recommendations} />
          <AnswerSection label="INSUFFICIENT DATA" items={answer.insufficientData} />
          <p className="text-xs text-black/50 dark:text-white/50">
            {answer.llmAssisted ? "LLM-assisted structuring" : "Mechanical mode (no LLM configured)"}
          </p>
        </div>
      )}
    </div>
  );
}

function AnswerSection({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="font-semibold text-xs tracking-wide uppercase text-black/50 dark:text-white/50">{label}</p>
      <ul className="list-disc list-inside">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
