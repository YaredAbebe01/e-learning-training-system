import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = cookies().get("auth_token")?.value;
  const headers = new Headers(options.headers || {});
  if (token && !headers.has("Cookie")) {
    headers.set("Cookie", `auth_token=${token}`);
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function requireUser() {
  const token = cookies().get("auth_token")?.value;
  if (!token) redirect("/login");

  const response = await apiFetch("/api/auth/me");

  if (!response.ok) redirect("/login");
  const payload = await response.json();
  return payload.user;
}

export async function requireRole(role: "admin" | "instructor" | "learner") {
  const user = await requireUser();
  if (user.role !== role) redirect("/dashboard");
  return user;
}
