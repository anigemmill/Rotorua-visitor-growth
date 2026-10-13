// Shared between server actions and client forms (no server-only imports).
export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;
