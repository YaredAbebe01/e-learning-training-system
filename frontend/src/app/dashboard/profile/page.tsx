import { apiFetch, requireUser } from "@/lib/auth-helpers";
import ProfileClient from "./profile-client";

export default async function ProfilePage() {
  await requireUser();
  const response = await apiFetch("/api/auth/profile");
  if (!response.ok) return null;

  const payload = await response.json();
  return <ProfileClient initialProfile={payload.profile} initialPoints={payload.points} />;
}