import { requireUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/dashboard/admin");
  if (user.role === "instructor") redirect("/dashboard/instructor");
  redirect("/dashboard/learner");
}
