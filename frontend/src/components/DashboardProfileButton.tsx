"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";

type ProfileButtonUser = {
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export default function DashboardProfileButton({ initialUser, compact = false }: { initialUser: ProfileButtonUser; compact?: boolean }) {
  const [user, setUser] = useState(initialUser);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<Partial<ProfileButtonUser>>;
      setUser((prev) => ({
        ...prev,
        full_name: customEvent.detail?.full_name || prev.full_name,
        email: customEvent.detail?.email || prev.email,
        avatar_url: customEvent.detail?.avatar_url === undefined ? prev.avatar_url : customEvent.detail.avatar_url,
      }));
    };

    window.addEventListener("profile-updated", handleProfileUpdated as EventListener);
    return () => window.removeEventListener("profile-updated", handleProfileUpdated as EventListener);
  }, []);

  return (
    <Link
      href="/dashboard/profile"
      className={`inline-flex items-center rounded-full border border-gray-200 bg-white shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50 ${compact ? "gap-2 px-2.5 py-1.5" : "gap-3 px-3 py-2"}`}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.full_name || user.email} className={`${compact ? "h-8 w-8" : "h-9 w-9"} rounded-full object-cover`} />
      ) : (
        <div className={`flex items-center justify-center rounded-full bg-violet-100 text-violet-700 ${compact ? "h-8 w-8" : "h-9 w-9"}`}>
          <UserCircle2 className="h-5 w-5" />
        </div>
      )}
      <div className="text-right leading-tight">
        <p className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gray-900`}>{user.full_name || user.email}</p>
        <p className="text-xs text-gray-500">Open profile</p>
      </div>
    </Link>
  );
}