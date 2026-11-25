import { Suspense } from "react";
import { AppShell } from "@/components/shared/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
