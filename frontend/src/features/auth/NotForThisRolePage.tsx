import { useAuth } from "../../contexts/AuthContext";

/**
 * Where AuthGuard sends a signed-in user whose role can't use the dashboard.
 *
 * The admin app had no role gate at all — `AuthGuard` was mounted without
 * `allowedRoles`, so an officer could sign in and browse every page, relying
 * on each API endpoint to refuse (AUDIT-2026-09-17, web). The backend is still
 * the real boundary; this stops the dashboard pretending otherwise.
 */
export default function NotForThisRolePage() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="max-w-md rounded-xl border border-ink-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-ink-900">This dashboard is for managers</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-600">
          Your account doesn't have manager access. Officers' shifts, check-ins, leave and pay are
          in the Mead Security app on your phone. If you should have access, ask your company admin.
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="mt-6 rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
