import { redirect } from "next/navigation";
import { getCurrentAdmin, isBootstrapOpen, MIN_PASSWORD_LENGTH } from "@/server/adminAuth";
import AdminAuthForm from "@/components/admin/AdminAuthForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  const setup = await isBootstrapOpen();

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16 bg-grid">
      <div className="panel w-full max-w-sm">
        <div className="panel-header">
          <span className="text-foreground">{setup ? "Create first admin" : "Admin sign-in"}</span>
          <span>Restricted</span>
        </div>
        <div className="p-5">
          {setup && (
            <p className="text-xs text-muted mb-4 leading-relaxed">
              No admin account exists yet. Use the configured admin email and this deployment&apos;s setup secret
              to create it, and choose a new password (at least {MIN_PASSWORD_LENGTH} characters). This form
              disappears once the account exists.
            </p>
          )}
          <AdminAuthForm mode={setup ? "setup" : "login"} minPasswordLength={MIN_PASSWORD_LENGTH} />
        </div>
      </div>
    </main>
  );
}
