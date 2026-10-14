// Programme timeline maths. All dates derive from Programme.startDate +
// week numbers, so changing the start date reschedules everything.

const DAY = 86_400_000;

export interface StageLike {
  name: string;
  startWeek: number;
  endWeek: number;
}

/** 1-based programme week for `today`. 0 = not started; > totalWeeks = finished. */
export function programmeWeek(startDate: Date, today: Date, totalWeeks: number): number {
  const days = Math.floor((startOfDay(today).getTime() - startOfDay(startDate).getTime()) / DAY);
  if (days < 0) return 0;
  return Math.min(Math.floor(days / 7) + 1, totalWeeks + 1);
}

export function weekStart(startDate: Date, week: number): Date {
  return new Date(startOfDay(startDate).getTime() + (week - 1) * 7 * DAY);
}

export function weekEnd(startDate: Date, week: number): Date {
  return new Date(weekStart(startDate, week).getTime() + 6 * DAY);
}

export function stageForWeek<T extends StageLike>(stages: T[], week: number): T | null {
  return stages.find((s) => week >= s.startWeek && week <= s.endWeek) ?? null;
}

export function programmePhaseLabel(week: number, totalWeeks: number): string {
  if (week === 0) return "Not started";
  if (week > totalWeeks) return "Programme complete";
  return `Week ${week} of ${totalWeeks}`;
}

/** Validates that stages are ordered, non-overlapping and inside the programme. */
export function validateStages(stages: StageLike[], totalWeeks: number): string | null {
  const sorted = [...stages].sort((a, b) => a.startWeek - b.startWeek);
  let prevEnd = 0;
  for (const s of sorted) {
    if (s.startWeek < 1 || s.endWeek > totalWeeks) return `"${s.name}" falls outside weeks 1–${totalWeeks}.`;
    if (s.endWeek < s.startWeek) return `"${s.name}" ends before it starts.`;
    if (s.startWeek <= prevEnd) return `"${s.name}" overlaps the previous stage.`;
    prevEnd = s.endWeek;
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export const DEFAULT_STAGES = [
  {
    order: 1, name: "Diagnose & baseline", startWeek: 1, endWeek: 2,
    goals: ["Operator onboarding", "Business assessments", "Website & booking journey reviews", "Baseline metrics", "Initial opportunity roadmaps"],
  },
  {
    order: 2, name: "Build & implement", startWeek: 3, endWeek: 6,
    goals: ["Select priority use cases", "Assign implementation tasks", "Record tools, costs & dependencies", "Document testing & approvals", "Track completion & adoption"],
  },
  {
    order: 3, name: "Collaborate & test", startWeek: 7, endWeek: 10,
    goals: ["Run shared experiments", "Document collaborative opportunities", "Track experiment performance", "Record problems & lessons"],
  },
  {
    order: 4, name: "Measure & decide", startWeek: 11, endWeek: 12,
    goals: ["Compare results against baselines", "Record supporting evidence", "Assess commercial value", "Create follow-on plans", "Draft case studies (with permission)", "Decide: scale, amend or stop"],
  },
];
