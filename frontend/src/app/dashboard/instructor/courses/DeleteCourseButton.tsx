"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteCourseButton({ courseId }: { courseId: string }) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Delete this course? This cannot be undone.")) return;
    await fetch(`/api/instructor/courses/${courseId}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <button
      onClick={handleDelete}
      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
      title="Delete course"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
