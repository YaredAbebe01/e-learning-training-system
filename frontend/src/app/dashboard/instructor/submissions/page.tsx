import { apiFetch, requireRole } from "@/lib/auth-helpers";
import SubmissionsClient from "./submissions-client";

export default async function InstructorSubmissionsPage() {
  await requireRole("instructor");

  const response = await apiFetch("/api/instructor/submissions");
  if (!response.ok) return null;

  const payload = await response.json();
  return <SubmissionsClient initialData={payload} />;
}