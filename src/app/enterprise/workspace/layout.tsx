import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { WorkspaceTabs } from "@/components/enterprise/WorkspaceTabs";

export const metadata = { title: "Workspace", description: "Enterprise workspace: team, usage, projects, security, billing and developers." };

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div>
          <Link href="/enterprise" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-fg"><ArrowLeft className="size-4" aria-hidden /> Enterprise</Link>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        </div>
        <p data-testid="ws-demo-banner" className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted">Demo workspace: sample data stored in this browser. Sections marked “Needs integration” are not active.</p>
      </div>
      <WorkspaceTabs />
      <div className="py-5">{children}</div>
    </div>
  );
}
