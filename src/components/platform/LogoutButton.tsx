import { logoutAction } from "@/app/(auth)/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-sm text-black/60 underline hover:text-black dark:text-white/60 dark:hover:text-white">
        Sign out
      </button>
    </form>
  );
}
