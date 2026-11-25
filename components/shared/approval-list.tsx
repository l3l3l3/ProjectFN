"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Approval } from "@/data/bonds";

const selectCls =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand";

export function ApprovalList({
  items,
  basePath,
  title,
}: {
  items: Approval[];
  /** path ของหน้ารายละเอียด เช่น "/approvals" หรือ "/tracking" */
  basePath: string;
  title: string;
}) {
  const router = useRouter();
  const [type, setType] = useState("all");

  const scope = items;
  const rows = scope.filter((a) => type === "all" || a.type.startsWith(type));

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            <span className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand">
              {scope.length} รอดำเนินการ
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            รายการตราสารหนี้ที่อยู่ระหว่างกระบวนการตรวจสอบและอนุมัติร่างแบบ
          </p>
        </div>
        <div className="flex gap-3">
          <select disabled className={selectCls} defaultValue="pending">
            <option value="pending">รอตรวจ</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="all">ทุกประเภท (ตราสาร / MTN / Reopen)</option>
            <option value="ตราสารหลัก">ตราสารหลัก</option>
            <option value="MTN">MTN (รายการย่อย)</option>
            <option value="Reopen">Reopen (รายการย่อย)</option>
          </select>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-surface text-xs font-bold text-slate-600">
                <th className="px-4 py-4 text-left">รหัส/ชื่อตราสาร</th>
                <th className="px-4 py-4 text-left">ประเภท</th>
                <th className="px-4 py-4 text-left">TEMPLATE</th>
                <th className="px-4 py-4 text-left">VERSION ปัจจุบัน</th>
                <th className="px-4 py-4 text-center">สถานะ</th>
                <th className="px-4 py-4 text-left">อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => router.push(`${basePath}/${a.id}`)}
                  className="cursor-pointer border-b border-slate-100 hover:bg-brand-50/60"
                >
                  <td className="px-4 py-3.5 text-xs font-bold text-slate-800">
                    <span className="mr-2 inline-block size-1.5 rounded-full bg-brand align-middle" />
                    {a.code}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-700">{a.type}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-600">{a.template}</td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-600">{a.version}</td>
                  <td className="px-4 py-3.5 text-center">
                    <StatusBadge status="pending" tone="rose" />
                  </td>
                  <td className="px-4 py-3.5 text-xs text-slate-500">{a.updatedAt}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    ไม่พบรายการที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 bg-surface px-5 py-3 text-xs text-slate-500">
          <span>
            แสดงทั้งหมด <b className="text-slate-900">{rows.length}</b> รายการ
          </span>
          <span className="flex items-center gap-2 font-semibold text-rose-500">
            <span className="size-2 rounded-full bg-rose-500" /> รอเจ้าหน้าที่ทำการตรวจสอบ
          </span>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Icon name="eye" className="size-3.5" /> คลิกที่แถวเพื่อเปิดดูตัวอย่างเอกสาร
      </p>
    </div>
  );
}
