import { Suspense } from "react";
import { ProjectsView } from "@/components/enterprise/projects/ProjectsView";

export const metadata = { title: "Projects" };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading projects…</p>}>
      <ProjectsView />
    </Suspense>
  );
}
