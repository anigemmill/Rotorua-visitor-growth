import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-12 dark:bg-neutral-950">
      <Link href="/" className="mb-8 text-sm font-semibold tracking-tight">
        Tourism Intelligence
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {children}
      </div>
    </div>
  );
}
