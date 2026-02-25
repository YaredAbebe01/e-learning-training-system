"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    level: "beginner",
    thumbnail_url: "",
  });

  const uploadImage = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    const data = new FormData();
    data.append("image", file);

    const response = await fetch("/api/uploads/image", {
      method: "POST",
      body: data,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.url) {
      setUploadError(payload?.error || "Upload failed. Try again.");
      setUploading(false);
      return;
    }

    setForm((prev) => ({ ...prev, thumbnail_url: payload.url }));
    setUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const response = await fetch("/api/instructor/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.id) {
      router.push(`/dashboard/instructor/courses/${payload.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/instructor/courses" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Create New Course</h1>
        <p className="text-gray-500 mt-1">Fill in the details to create your course</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g. Introduction to Web Development"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 h-28 resize-none"
              placeholder="Describe what learners will achieve..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="e.g. Technology, Business"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course Thumbnail (Image)</label>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-700">Upload a course cover image.</p>
                  <p className="text-xs text-gray-500">PNG or JPG up to 5MB.</p>
                </div>
                <label className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 cursor-pointer transition-colors">
                  Choose Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFileName(file.name);
                        uploadImage(file);
                      } else {
                        setSelectedFileName("");
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
              {selectedFileName && (
                <p className="text-xs text-gray-600 mt-2">Selected: {selectedFileName}</p>
              )}
              {uploading && <p className="text-xs text-purple-600 mt-2">Uploading image...</p>}
              {uploadError && <p className="text-xs text-red-500 mt-2">{uploadError}</p>}
            </div>
            {form.thumbnail_url && (
              <div className="mt-3">
                <img
                  src={form.thumbnail_url}
                  alt="Course thumbnail"
                  className="h-32 w-full object-cover rounded-lg border border-gray-100"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? "Creating..." : uploading ? "Uploading..." : "Create Course"}
          </button>
        </form>
      </div>
    </div>
  );
}
