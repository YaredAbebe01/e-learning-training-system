import { requireUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardProfileButton from "@/components/DashboardProfileButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        role={user.role}
        userName={user.name || user.email}
        userEmail={user.email}
        userAvatarUrl={user.avatar_url || null}
        userFullName={user.full_name || user.name || user.email}
      />
      <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="hidden lg:block border-b border-gray-200 bg-white/90 backdrop-blur-sm px-6 py-4 sticky top-14 lg:top-0 z-20">
          <div className="flex items-center justify-end">
            <DashboardProfileButton
              initialUser={{
                full_name: user.full_name || user.name || user.email,
                email: user.email,
                avatar_url: user.avatar_url || null,
              }}
            />
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
