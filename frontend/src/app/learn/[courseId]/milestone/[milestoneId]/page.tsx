"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface PageProps {
  params: Promise<{ courseId: string; milestoneId: string }>;
}

export default function LearnerMilestonePage({ params }: PageProps) {
  const router = useRouter();

  useEffect(() => {
    params.then((resolved) => {
      router.replace(`/learn/${resolved.courseId}?milestoneId=${resolved.milestoneId}`);
    });
  }, [params, router]);

  return <div className="min-h-screen bg-gray-950" />;
}