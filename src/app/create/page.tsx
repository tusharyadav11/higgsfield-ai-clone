import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateStudio } from "@/components/features/create-studio";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold text-fg">Create</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-surface" />}>
        <CreateStudio />
      </Suspense>
    </div>
  );
}
