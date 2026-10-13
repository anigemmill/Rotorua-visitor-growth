import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-sm text-black/60 dark:text-white/60">It may have moved, or you may not have access to it.</p>
      <Link href="/workspaces" className="text-sm underline">
        Go to your workspaces
      </Link>
    </div>
  );
}
