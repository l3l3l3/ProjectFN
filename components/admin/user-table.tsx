"use client";

import { useState } from "react";
import { Icon } from "@/components/shared/icon";

type UserRole = "company" | "officer" | "admin";

const roleLabel: Record<UserRole, string> = {
  company: "บริษัทผู้ส่งเอกสาร",
  officer: "เจ้าหน้าที่ตรวจสอบ",
  admin: "ผู้ดูแลระบบ",
};
const roleStyle: Record<UserRole, string> = {
  company: "bg-sky-50 text-sky-700 border-sky-200",
  officer: "bg-brand-50 text-brand border-orange-200",
  admin: "bg-violet-50 text-violet-700 border-violet-200",
};

interface User {
  id: number;
  name: string;
  org: string;
  role: UserRole;
  active: boolean;
}

const initial: User[] = [
  { id: 1, name: "สมชาย ใจดี", org: "บริษัท aaa", role: "company", active: true },
  { id: 2, name: "สมหญิง รักงาน", org: "บริษัท bbb", role: "company", active: true },
  { id: 3, name: "วิชัย มั่นคง", org: "บริษัท ccc", role: "company", active: false },
  { id: 4, name: "อัญชลี ศิริวัฒน์", org: "ก.ล.ต. – ฝ่ายตรวจสอบ", role: "officer", active: true },
  { id: 5, name: "ธนากร พิทักษ์", org: "ก.ล.ต. – ฝ่ายตรวจสอบ", role: "officer", active: true },
  { id: 6, name: "ผู้ดูแลระบบหลัก", org: "ฝ่ายไอที", role: "admin", active: true },
];

export function UserTable() {
  const [users, setUsers] = useState(initial);
  const [filter, setFilter] = useState<"all" | UserRole>("all");

  const rows = users.filter((u) => filter === "all" || u.role === filter);
  const toggle = (id: number) =>
    setUsers((us) => us.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h1>
          <p className="mt-1 text-sm text-slate-500">
            กำหนดบทบาทและเปิด/ปิดการใช้งานบัญชีผู้ใช้ในระบบ
          </p>
        </div>
      </div>

      <div className="mt-6 flex gap-2">
        {(["all", "company", "officer", "admin"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
              filter === k
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand/50"
            }`}
          >
            {k === "all" ? "ทั้งหมด" : roleLabel[k]}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-surface text-xs font-bold text-slate-600">
              <th className="px-4 py-4 text-left">ชื่อผู้ใช้</th>
              <th className="px-4 py-4 text-left">หน่วยงาน</th>
              <th className="px-4 py-4 text-left">บทบาท</th>
              <th className="px-4 py-4 text-center">สถานะบัญชี</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3.5 text-xs font-bold text-slate-800">{u.name}</td>
                <td className="px-4 py-3.5 text-xs text-slate-600">{u.org}</td>
                <td className="px-4 py-3.5">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${roleStyle[u.role]}`}
                  >
                    {roleLabel[u.role]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-center">
                  <button
                    onClick={() => toggle(u.id)}
                    role="switch"
                    aria-checked={u.active}
                    aria-label={`เปิด/ปิดบัญชี ${u.name}`}
                    className={`relative h-6 w-11 rounded-full transition-colors ${
                      u.active ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${
                        u.active ? "left-[22px]" : "left-0.5"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
