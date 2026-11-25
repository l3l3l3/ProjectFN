"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/shared/icon";
import type { Approval } from "@/data/bonds";

export function ApprovalPreview({
  item,
  mode,
  backHref,
  backLabel,
}: {
  item: Approval;
  /** officer = อนุมัติ/ปฏิเสธได้, company = ดูอย่างเดียว */
  mode: "officer" | "company";
  backHref: string;
  backLabel: string;
}) {
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const isOfficer = mode === "officer";

  return (
    <div className="flex min-h-full flex-col p-6 lg:p-8">
      <Link
        href={backHref}
        className="mb-3 inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand"
      >
        <Icon name="arrowLeft" className="size-3.5" /> {backLabel}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">รอตรวจ/อนุมัติ</h1>
            <span className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand">
              {decision === "approved"
                ? "สถานะ: อนุมัติแล้ว"
                : decision === "rejected"
                  ? "สถานะ: ปฏิเสธ"
                  : "สถานะ: รอพิจารณา"}
            </span>
          </div>
          <p className="mt-3 rounded-lg border border-orange-100 bg-brand-50 px-3 py-2 text-xs text-slate-600">
            รหัส/ชื่อตราสาร ประเภท:{" "}
            <b className="text-slate-900">
              {item.code} {item.name}
            </b>
          </p>
        </div>
      </div>

      <section className="mt-5 flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand">
            <Icon name="doc" />
          </span>
          <p className="flex-1 text-xs">
            <span className="font-bold tracking-wide text-slate-400">DOCUMENT PREVIEW SHEET</span>
            <span className="mx-2 text-slate-300">|</span>
            <span className="font-bold text-slate-900">
              แบบร่างข้อกำหนดสิทธิและหนังสือชี้ชวน (ร่างมาตรฐาน ฉบับที่ {item.id})
            </span>
          </p>
          <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-surface px-3 py-1 text-[11px] text-slate-500">
            <Icon name="eye" className="size-3.5" /> โหมดแสดงตัวอย่าง (Preview Only)
          </span>
        </div>

        <div className="grid min-h-[360px] flex-1 place-items-center bg-slate-50/60 p-8 text-center">
          <div className="flex flex-col items-center">
            <span className="grid size-14 place-items-center rounded-2xl border border-orange-200 bg-brand-50 text-brand">
              <Icon name="layout" className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              โชว์รายละเอียดข้อมูลและหน้าตาเทมเพลตที่ใช้
            </h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              โครงสร้างการจัดวางหน้าข้อมูลตราสาร เช่น อัตราดอกเบี้ย, งวดการชำระ, ผู้แทนผู้ถือหุ้นกู้
              และข้อกำหนดเฉพาะของเทมเพลตมาตรฐาน
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px] font-semibold text-brand">
              <span className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1">
                # เทมเพลต: Corporate Bond Form 01
              </span>
              <span className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1">
                # รหัสอ้างอิง: {item.templateRef}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-3">
          {decision && (
            <span role="status" className="mr-auto text-xs font-semibold text-slate-600">
              {decision === "approved" ? "อนุมัติรายการนี้เรียบร้อยแล้ว" : "ปฏิเสธรายการนี้แล้ว"}
            </span>
          )}
          {isOfficer ? (
            <>
              <button
                disabled={!!decision}
                onClick={() => setDecision("rejected")}
                className="h-10 rounded-lg bg-slate-100 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
              >
                ปฏิเสธ
              </button>
              <button
                disabled={!!decision}
                onClick={() => setDecision("approved")}
                className="h-10 rounded-lg bg-brand px-6 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50"
              >
                อนุมัติ
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-400">
              เฉพาะเจ้าหน้าที่ตรวจสอบเท่านั้นที่อนุมัติ/ปฏิเสธได้
            </span>
          )}
        </div>
      </section>
    </div>
  );
}
