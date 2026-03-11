import { apiFetch, requireRole } from "@/lib/auth-helpers";
import AnalyticsClient from "./analytics-client";

export default async function InstructorAnalyticsPage() {
  await requireRole("instructor");
  const response = await apiFetch("/api/instructor/analytics");
  if (!response.ok) return null;

  const payload = await response.json();
  return <AnalyticsClient initialData={payload} />;
}
