import { Metadata } from "next";
import { HealthDashboard } from "@/components/health/health-dashboard";

export const metadata: Metadata = {
  title: "System Health | Shayon's News",
  description: "Monitor system health and performance metrics",
};

export default function HealthPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <HealthDashboard />
    </div>
  );
}
