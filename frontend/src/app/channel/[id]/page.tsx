import { Suspense } from "react";
import ChannelDashboard, { DashboardSkeleton } from "@/components/ChannelDashboard";

export default function ChannelPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <ChannelDashboard />
    </Suspense>
  );
}
