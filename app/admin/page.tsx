import { isAdminAuthenticated } from "@/lib/admin-auth";
import { listAllDonors } from "@/lib/infra/repositories/donorRepository";
import { AdminLoginForm } from "./AdminLoginForm";
import { AdminDashboard } from "./AdminDashboard";

export const metadata = {
  title: "Admin — Lifeline Lahore",
};

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();

  if (!authed) {
    return (
      <main className="tint-gradient flex min-h-[70vh] items-center justify-center px-4 py-10 sm:px-8">
        <div className="card flex w-full max-w-140 flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-display text-ink-primary">Admin</h1>
            <p className="text-body text-ink-secondary">
              Sign in with the society&apos;s admin password to manage donors.
            </p>
          </div>
          <AdminLoginForm />
        </div>
      </main>
    );
  }

  const donors = (await listAllDonors()).map((donor) => ({
    ...donor,
    lastDonationDate: donor.lastDonationDate
      ? new Date(donor.lastDonationDate).toISOString()
      : null,
  }));

  return <AdminDashboard donors={donors} />;
}
