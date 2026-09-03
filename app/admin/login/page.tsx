import { login } from "@/app/admin/actions";
import { isAuthed } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Admin Login — Waiver Wire Wizards",
};

export default async function AdminLoginPage({
  searchParams,
}: PageProps<"/admin/login">) {
  if (await isAuthed()) {
    redirect("/admin");
  }
  const params = await searchParams;
  const hasError = params?.error === "1";
  const isRateLimited = params?.error === "ratelimited";

  return (
    <div className="max-w-sm mx-auto px-4 py-16">
      <div className="wwz-card p-6">
        <h1 className="font-display font-700 text-xl text-purple mb-1">
          Commissioner Login
        </h1>
        <p className="text-sm text-ink/60 mb-5">
          Enter the admin password to manage challenge winners, FAAB, and payouts.
        </p>
        {hasError && (
          <p className="text-sm text-red-600 mb-4">Incorrect password. Try again.</p>
        )}
        {isRateLimited && (
          <p className="text-sm text-red-600 mb-4">
            Too many attempts. Please wait a few minutes and try again.
          </p>
        )}
        <form action={login} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-600 text-ink/70 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoFocus
              className="w-full rounded border border-purple/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-purple text-cream font-600 py-2 text-sm hover:bg-purple-light transition-colors"
          >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
