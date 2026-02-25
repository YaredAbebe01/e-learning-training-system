"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle } from "lucide-react";

export default function EnrollButton({ courseId, isEnrolled }: { courseId: string; isEnrolled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [enrolled, setEnrolled] = useState(isEnrolled);

  const handleEnroll = async () => {
    if (enrolled) {
      router.push(`/learn/${courseId}`);
      return;
    }
    setLoading(true);
    await fetch("/api/learner/enroll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    setEnrolled(true);
    setLoading(false);
    router.push(`/learn/${courseId}`);
  };

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
        enrolled
          ? "bg-green-50 text-green-700 hover:bg-green-100"
          : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400"
      }`}
    >
      {enrolled ? <><CheckCircle className="w-4 h-4" /> Continue Learning</> : loading ? "Enrolling..." : "Enroll Now"}
    </button>
  );
}
