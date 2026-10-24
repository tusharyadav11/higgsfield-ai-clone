import type { Metadata } from "next";
import { EnterpriseView } from "@/components/enterprise/EnterpriseView";

export const metadata: Metadata = {
  title: "Enterprise",
  description: "Shared credits, volume pricing and a team workspace for creative teams. Size your team, see an indicative price and request a quote.",
};

export default function Page() {
  return <EnterpriseView />;
}
