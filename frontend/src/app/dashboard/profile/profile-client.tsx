"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, KeyRound, Mail, Save, Sparkles, User2 } from "lucide-react";

type ProfileData = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "instructor" | "learner";
  avatar_url?: string | null;
  bio?: string | null;
  created_at?: string;
};

type PointsData = {
  total: number;
  recent: Array<{ id: string; note?: string | null; points: number; created_at: string; course?: { title?: string } | null }>;
};

export default function ProfileClient({ initialProfile, initialPoints }: { initialProfile: ProfileData; initialPoints: PointsData }) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [points] = useState(initialPoints || { total: 0, recent: [] });
  const [fullName, setFullName] = useState(initialProfile.full_name || "");
  const [email, setEmail] = useState(initialProfile.email || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatar_url || "");
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [selectedImageName, setSelectedImageName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const displayAvatarUrl = avatarUrl || profile.avatar_url || "";

  const broadcastProfileUpdate = (next: Partial<ProfileData> & { email?: string }) => {
    window.dispatchEvent(new CustomEvent("profile-updated", {
      detail: {
        full_name: next.full_name || fullName,
        email: next.email || email,
        avatar_url: next.avatar_url === undefined ? displayAvatarUrl || null : next.avatar_url,
      },
    }));
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileMessage(null);

    const response = await fetch("/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, email, avatar_url: avatarUrl, bio }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setProfileError(payload?.error || "Unable to update profile.");
      setSavingProfile(false);
      return;
    }

    setProfile(payload.profile);
    setAvatarUrl(payload.profile?.avatar_url || avatarUrl);
    setProfileMessage("Profile updated successfully.");
    setSavingProfile(false);
    broadcastProfileUpdate(payload.profile || {});
    router.refresh();
  };

  const uploadProfileImage = async (file?: File | null) => {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setProfileError("Only JPG and PNG images are allowed.");
      return;
    }

    setUploadingImage(true);
    setProfileError(null);
    setProfileMessage(null);
    setSelectedImageName(file.name);

    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("/api/uploads/profile-image", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setProfileError(payload?.error || "Unable to upload profile image.");
      setUploadingImage(false);
      return;
    }

    const nextUrl = payload?.url || payload?.profile?.avatar_url || "";
    setAvatarUrl(nextUrl);
    if (payload?.profile) {
      setProfile(payload.profile);
    } else {
      setProfile((prev) => ({ ...prev, avatar_url: nextUrl }));
    }
    setProfileMessage("Profile image uploaded successfully.");
    setUploadingImage(false);
    broadcastProfileUpdate({ avatar_url: nextUrl });
    router.refresh();
  };

  const savePassword = async () => {
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordMessage(null);

    const response = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setPasswordError(payload?.error || "Unable to change password.");
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setPasswordMessage("Password updated successfully.");
    setSavingPassword(false);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="lg:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-violet-300 hover:text-violet-700">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-950 via-violet-950 to-slate-900 text-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
        <div className="grid gap-8 px-8 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
          <div className="flex flex-col items-center rounded-[28px] border border-white/10 bg-white/5 p-6 text-center backdrop-blur-sm">
            {displayAvatarUrl ? (
              <img src={displayAvatarUrl} alt={profile.full_name} className="h-32 w-32 rounded-full border-4 border-white/15 object-cover shadow-lg" />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/15 bg-white/10 text-white shadow-lg">
                <User2 className="h-14 w-14" />
              </div>
            )}
            <h1 className="mt-5 text-3xl font-bold">{profile.full_name}</h1>
            <p className="mt-2 text-sm uppercase tracking-[0.25em] text-violet-200">{profile.role} profile</p>
            <p className="mt-4 text-sm leading-6 text-slate-200">{bio || "Add a short professional description so other people understand who you are and what you focus on."}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:col-span-2">
              <p className="text-xs uppercase tracking-[0.25em] text-violet-200">Email</p>
              <p title={profile.email} className="mt-3 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-semibold text-white/95">{profile.email}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-violet-200">Points</p>
              <p className="mt-3 text-4xl font-bold">{points.total ?? 0}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.25em] text-violet-200">Member Since</p>
              <p className="mt-3 text-lg font-semibold">{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</p>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:col-span-4">
              <div className="flex items-center gap-2 text-violet-100"><Sparkles className="h-4 w-4" /> Professional profile hub</div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">Keep your personal details current, update your portrait, manage your password securely, and track your points from one place.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <User2 className="h-5 w-5 text-violet-600" />
            <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
          </div>
          {profileError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</div>}
          {profileMessage && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{profileMessage}</div>}
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Full name</span>
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500"><Mail className="h-3.5 w-3.5" /> Email</span>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500"><Camera className="h-3.5 w-3.5" /> Profile photo</span>
              <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => uploadProfileImage(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-700"
                />
                <p className="mt-3 text-xs text-gray-500">Upload a JPG or PNG image. The file is stored in Cloudinary and the returned link is saved to your profile.</p>
                {selectedImageName && <p className="mt-2 text-xs font-medium text-gray-700">Selected: {selectedImageName}</p>}
                {avatarUrl && <p className="mt-2 truncate text-xs text-gray-500">Saved Cloudinary URL: {avatarUrl}</p>}
              </div>
            </label>
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Description</span>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={6} placeholder="Write a short professional introduction about yourself." className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
            </label>
          </div>
          <button onClick={saveProfile} disabled={savingProfile || uploadingImage} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {uploadingImage ? "Uploading image..." : savingProfile ? "Saving..." : "Save profile"}
          </button>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-violet-600" />
              <h2 className="text-xl font-semibold text-gray-900">Security</h2>
            </div>
            {passwordError && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</div>}
            {passwordMessage && <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{passwordMessage}</div>}
            <div className="mt-5 space-y-4">
              <label>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">Current password</span>
                <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-gray-500">New password</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm" />
              </label>
            </div>
            <button onClick={savePassword} disabled={savingPassword} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <KeyRound className="h-4 w-4" /> {savingPassword ? "Updating..." : "Change password"}
            </button>
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900">Recent Point Activity</h2>
            <div className="mt-5 space-y-3">
              {(points.recent || []).map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{entry.note || "Point update"}</p>
                    <p className="text-xs text-gray-500">{entry.course?.title ? `${entry.course.title} • ` : ""}{new Date(entry.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-sm font-semibold ${entry.points >= 0 ? "text-green-600" : "text-red-600"}`}>{entry.points >= 0 ? `+${entry.points}` : entry.points}</span>
                </div>
              ))}
              {!points.recent?.length && <p className="text-sm text-gray-400">No recent point activity yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}