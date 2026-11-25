"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/shared/sidebar";
import { canAccess, roleConfig } from "@/lib/roles";
import { useSession } from "@/lib/use-session";

/** กันหน้าภายใน: ยังไม่ login → กลับ Login, เข้าหน้าที่ role ไม่มีสิทธิ์ → เด้งไปหน้าแรกของ role */
export function AppShell({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const allowed = session ? canAccess(session.role, pathname) : false;

  useEffect(() => {
    if (session === null) router.replace("/");
    else if (session && !allowed) router.replace(roleConfig[session.role].home);
  }, [session, allowed, router]);

  if (!session || !allowed) return <div className="min-h-screen bg-surface" />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar session={session} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-surface">{children}</main>
    </div>
  );
}
