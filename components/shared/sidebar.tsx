"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { bonds, approvals } from "@/data/bonds";
import { roleConfig } from "@/lib/roles";
import { clearSession, type Session } from "@/lib/session";

export function Sidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const router = useRouter();
  const config = roleConfig[session.role];

  // badge ตัวเลขข้างเมนู (บริษัทเห็นเฉพาะรายการของตัวเอง 3 รายการ)
  const counts: Record<string, number> = {
    "/bonds": bonds.length,
    "/approvals": approvals.length,
    "/tracking": 3,
  };

  const logout = () => {
    clearSession();
    router.push("/");
  };

  return (
    <aside className="flex h-screen w-[200px] shrink-0 flex-col bg-navy text-white lg:w-[220px]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="grid size-9 place-items-center rounded-xl bg-brand shadow-lg shadow-brand/30">
          <Icon name="doc" className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold">Bond Portal</p>
          <p className="text-[10px] text-slate-300">ระบบบริหารจัดการตราสารหนี้</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {config.nav.map((section, i) => (
          <div key={section.title} className={i > 0 ? "mt-6" : ""}>
            <p className="mb-2 px-3 text-[11px] font-semibold text-slate-400">{section.title}</p>
            <ul className="space-y-1">
              {section.items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(it.href + "/");
                const count = counts[it.href];
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        active ? "bg-brand text-white shadow-sm" : "text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Icon name={it.icon} className="size-[18px]" />
                      <span className="flex-1">{it.label}</span>
                      {count !== undefined && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] ${
                            active ? "bg-white/25 text-white" : "bg-white/10 text-slate-200"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 bg-black/10 px-4 py-4">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-orange-300 ring-1 ring-orange-400/50">
          AU
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold">{session.label}</p>
          <button
            onClick={logout}
            className="text-[11px] text-slate-300 underline-offset-2 hover:text-white hover:underline"
          >
            ออกจากระบบ (Logout)
          </button>
        </div>
      </div>
    </aside>
  );
}
