import type { Metadata } from "next";
import { AuthForm } from "@/components/growth/AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default function Page() {
  return (
    <div className="px-4 py-8">
      <AuthForm mode="login" />
    </div>
  );
}
