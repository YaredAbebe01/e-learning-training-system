"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import DashboardProfileButton from "@/components/DashboardProfileButton";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  GraduationCap,
  BarChart3,
  LogOut,
  Menu,
  X,
  Award,
  PlusCircle,
  BookMarked,
  ClipboardList,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  role: "admin" | "instructor" | "learner";
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  userFullName: string;
}

const navItems: Record<string, NavItem[]> = {
  admin: [
    { label: "Dashboard", href: "/dashboard/admin", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Users", href: "/dashboard/admin/users", icon: <Users className="w-5 h-5" /> },
    { label: "Courses", href: "/dashboard/admin/courses", icon: <BookOpen className="w-5 h-5" /> },
    { label: "Reports", href: "/dashboard/admin/reports", icon: <BarChart3 className="w-5 h-5" /> },
  ],
  instructor: [
    { label: "Dashboard", href: "/dashboard/instructor", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "My Courses", href: "/dashboard/instructor/courses", icon: <BookOpen className="w-5 h-5" /> },
    { label: "Create Course", href: "/dashboard/instructor/courses/new", icon: <PlusCircle className="w-5 h-5" /> },
    { label: "Submissions", href: "/dashboard/instructor/submissions", icon: <ClipboardList className="w-5 h-5" /> },
    { label: "Analytics", href: "/dashboard/instructor/analytics", icon: <BarChart3 className="w-5 h-5" /> },
  ],
  learner: [
    { label: "Dashboard", href: "/dashboard/learner", icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: "Browse Courses", href: "/dashboard/learner/courses", icon: <BookMarked className="w-5 h-5" /> },
    { label: "My Learning", href: "/dashboard/learner/my-learning", icon: <GraduationCap className="w-5 h-5" /> },
    { label: "Certificates", href: "/dashboard/learner/certificates", icon: <Award className="w-5 h-5" /> },
    { label: "Progress", href: "/dashboard/learner/progress", icon: <BarChart3 className="w-5 h-5" /> },
  ],
};

const roleColors: Record<string, string> = {
  admin: "bg-red-600",
  instructor: "bg-purple-600",
  learner: "bg-blue-600",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  instructor: "Instructor",
  learner: "Learner",
};

export default function Sidebar({ role, userName, userEmail, userAvatarUrl, userFullName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  };

  const items = navItems[role] || [];
  const accentColor = roleColors[role];

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {!isMobile && (
        <div className={`${accentColor} px-6 py-5`}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white px-2 py-2 shadow-sm">
              <BrandLogo size={28} priority className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">LearnHub</h1>
              <span className="text-white/70 text-xs">{roleLabels[role]} Portal</span>
            </div>
          </div>
        </div>
      )}

      <nav className={`flex-1 px-3 space-y-1 ${isMobile ? "py-4" : "py-4"}`}>
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? `${accentColor} text-white shadow-sm`
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-gray-100">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <BrandLogo size={28} priority className="h-7 w-7 object-contain" />
          <span className="font-bold text-gray-900">LearnHub</span>
        </div>
        <DashboardProfileButton
          initialUser={{
            full_name: userFullName || userName,
            email: userEmail,
            avatar_url: userAvatarUrl,
          }}
          compact
        />
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 flex">
          <div className="w-64 bg-white h-full shadow-xl mt-14">
            <SidebarContent isMobile />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
