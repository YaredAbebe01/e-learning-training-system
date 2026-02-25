"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ClipboardList,
  BookMarked,
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
    { label: "Quizzes", href: "/dashboard/instructor/quizzes", icon: <ClipboardList className="w-5 h-5" /> },
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

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  };

  const items = navItems[role] || [];
  const accentColor = roleColors[role];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className={`${accentColor} px-6 py-5`}>
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-xl p-2">
            <BookOpen className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">LearnHub</h1>
            <span className="text-white/70 text-xs">{roleLabels[role]} Portal</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`${accentColor} w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm`}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{userName}</p>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full text-white ${accentColor}`}>
              {roleLabels[role]}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
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
        <div className="flex items-center gap-2">
          <div className={`${accentColor} rounded-lg p-1.5`}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900">LearnHub</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 flex">
          <div className="w-64 bg-white h-full shadow-xl mt-14">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/30" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
}
