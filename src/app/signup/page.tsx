import type { Metadata } from "next";
import { AuthForm } from "@/components/growth/AuthForm";

export const metadata: Metadata = { title: "Sign up" };

export default function Page() {
  return (
    <div className="px-4 py-8">
      <AuthForm mode="signup" />
    </div>
  );
}
