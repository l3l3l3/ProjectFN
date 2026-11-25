"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/icon";
import { StatusBadge } from "@/components/shared/status-badge";
import { bonds, type Bond } from "@/data/bonds";
import { useApprovals } from "@/lib/approvals-store";
import type { ApprovalItem } from "@/lib/approvals-store";
import { useSession } from "@/lib/use-session";
import { allowedCompanies, matchesCompany } from "@/lib/company-access";
import {
  bondSheetUrl,
  companyOf,
  docUrl,
  formatSize,
  isBondSheetLabel,
  isMine,
  normalize,
  symbolOf,
  versionsOf,
  type StoredDocument,
} from "@/lib/submission-docs";

const selectCls =
  "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand";

/* ---------- เอกสารประกอบ: ดึงจากรายการที่ส่งเอกสาร (approvals) + คลังเอกสาร /api/documents ---------- */
type PreviewTarget = { title: string; url: string };

// รายการที่ส่งเอกสารที่ตรงกับตราสารนี้ (จับคู่จาก symbol / รหัส / ผู้ออก) — เลือกอันที่อนุมัติแล้วล่าสุดก่อน
function itemForBond(bond: Bond, items: ApprovalItem[]): ApprovalItem | undefined {
  const symbol = normalize(bond.symbol || "");
  const code = normalize(bond.code || "");
  const issuer = normalize(bond.issuer || "");
  const matched = items.filter((i) => {
    const s = normalize(symbolOf(i));
    const c = normalize(companyOf(i));
    const symbolHit = !!s && (s === symbol || s === code);
    const issuerHit = c.length >= 3 && !!issuer && (issuer.includes(c) || c.includes(issuer));
    return symbolHit || issuerHit;
  });
  return [...matched].sort(
    (a, b) => Number(b.status === "approved") - Number(a.status === "approved") || Number(b.id) - Number(a.id),
  )[0];
}

// หน้าส่งตรวจสอบเอกสาร = app/(app)/(company)/bonds/submit/page.tsx → URL /bonds/submit
// (วงเล็บ (app) และ (company) เป็น route group ไม่นับเป็นส่วนหนึ่งของ URL)
const REVIEW_PATH = "/bonds/submit";

// ค่าที่กรอกในแบบข้อมูลตราสารหนี้ (เก็บอยู่ใน item.bondData.values)
const bondValues = (item: ApprovalItem): Record<string, string> =>
  (item as unknown as { bondData?: { values?: Record<string, string> } }).bondData?.values ?? {};

const RATE_KEYS = ["couponRate", "interestRate", "coupon", "rate", "couponInterestRate"];
// ค่าอัตราดอกเบี้ยต้องเป็นตัวเลข (อาจมี %) ไม่ใช่วันที่ เช่น 2026-11-21 หรือ 21/11/2026
const looksLikeRate = (v: string) => /^\d+(\.\d+)?\s*%?$/.test(v.trim());
// ชื่อช่องที่ไม่ใช่อัตรา เช่น วันที่ชำระดอกเบี้ย / งวด / ความถี่
const NOT_RATE_KEY = /date|วัน|day|freq|period|payment|ชำระ|งวด|ความถี่|เริ่ม|สิ้นสุด|maturity|issue/i;

function rateKeyValue(values: Record<string, string>): string {
  // 1) ชื่อคีย์ที่รู้จักตรง ๆ (ยอมรับเฉพาะค่าที่เป็นตัวเลข)
  for (const k of RATE_KEYS) {
    const v = values[k]?.trim();
    if (v && looksLikeRate(v)) return v;
  }
  // 2) เดาจากชื่อคีย์ที่มีคำว่า coupon / interest / ดอกเบี้ย / อัตรา แต่ตัดช่องวันที่-งวดออก
  const k = Object.keys(values).find(
    (key) =>
      /coupon|interest|ดอกเบี้ย|อัตรา/i.test(key) &&
      !NOT_RATE_KEY.test(key) &&
      looksLikeRate(values[key] ?? ""),
  );
  return k ? values[k].trim() : "";
}
const isNumeric = (v: string) => /^[\d.,\s]+$/.test(v);
function formatAmount(raw: string): string {
  const v = raw.trim();
  if (!v) return "—";
  if (!isNumeric(v)) return v;
  const n = Number(v.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return v;
  return n >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("th-TH", { maximumFractionDigits: 2 })} ล้านบาท`
    : `${n.toLocaleString("th-TH")} บาท`;
}
function formatRate(raw: string): string {
  const v = raw.trim();
  if (!v) return "—";
  return isNumeric(v) ? `${v.replace(/\s/g, "")}%` : v;
}

// สร้างแถวตราสารจากรายการที่ส่งเอกสาร (เฉพาะที่ยังไม่มีในข้อมูล bonds เดิม) ใช้แสดง BBB, BBBB ฯลฯ
function bondFromItem(item: ApprovalItem): Bond {
  const versions = versionsOf(item);
  const latest = versions[versions.length - 1];
  const template = item.receipt?.templateName || item.docType || "เอกสารทั่วไป";
  return {
    id: `sub-${item.id}`,
    code: `[ส่งเอกสาร #${item.id}]`,
    symbol: symbolOf(item),
    issuer: companyOf(item),
    status: item.status === "approved" ? "complete" : item.status === "pending" ? "pending" : "draft",
    amount: formatAmount(bondValues(item).issueSize ?? ""),
    rate: formatRate(rateKeyValue(bondValues(item))),
    type: "ตราสารหลัก",
    template,
    version: latest?.version ?? "",
    createdAt: item.submittedAt,
    editor: item.submitter,
  } as unknown as Bond;
}

function submissionBonds(items: ApprovalItem[]): Bond[] {
  const existing = new Set(bonds.flatMap((b) => [normalize(b.symbol || ""), normalize(b.code || "")]));
  const bySymbol = new Map<string, ApprovalItem>();
  for (const i of items) {
    const key = normalize(symbolOf(i)) || `id-${i.id}`;
    if (existing.has(key)) continue;
    const cur = bySymbol.get(key);
    const better =
      !cur ||
      Number(i.status === "approved") > Number(cur.status === "approved") ||
      (i.status === cur.status && Number(i.id) > Number(cur.id));
    if (better) bySymbol.set(key, i);
  }
  return [...bySymbol.values()].map(bondFromItem);
}

function PdfPreviewDialog({ preview, onClose }: { preview: PreviewTarget; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ตัวอย่าง PDF ${preview.title}`}
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{preview.title}</p>
            <p className="text-[11px] text-slate-400">ตัวอย่างเอกสาร PDF</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-medium text-brand hover:bg-brand-50"
            >
              เปิดแท็บใหม่
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:bg-brand-600"
            >
              ปิด
            </button>
          </div>
        </div>
        <iframe
          key={preview.url}
          src={`${preview.url}#toolbar=0&navpanes=0&view=FitH`}
          title={`PDF ${preview.title}`}
          className="min-h-0 w-full flex-1 bg-slate-100"
        />
      </div>
    </div>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 text-xs last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-semibold ${accent ? "text-brand" : "text-slate-900"}`}>
        {value}
      </span>
    </div>
  );
}

function DetailPanel({
  bond,
  item,
  storedDocs,
  docsLoading,
  onPreview,
  onClose,
  canEdit,
}: {
  canEdit: boolean; // เจ้าหน้าที่ตรวจสอบ (officer) แก้ไขข้อมูลไม่ได้
  bond: Bond;
  item?: ApprovalItem; // รายการที่ส่งเอกสารของตราสารนี้ (เฉพาะที่ผู้ใช้มีสิทธิ์เห็น)
  storedDocs: StoredDocument[];
  docsLoading: boolean;
  onPreview: (p: PreviewTarget) => void;
  onClose: () => void;
}) {
  const versions = item ? versionsOf(item) : [];
  const latest = versions[versions.length - 1];
  const draftUrl = item && latest ? bondSheetUrl(item, latest, versions, storedDocs) : null;

  // ส่ง id ของรายการที่ส่งเอกสารไปหน้า submit เพื่อให้เติมข้อมูลเดิมลงฟอร์ม (?edit=<id>)
  const editHref = item ? `${REVIEW_PATH}?edit=${encodeURIComponent(String(item.id))}` : REVIEW_PATH;

  // ไฟล์แนบของเวอร์ชันล่าสุด (ตัดแบบข้อมูลตราสารหนี้ออก เพราะใช้กับปุ่ม Preview แล้ว)
  const files = (latest?.files ?? []).filter(
    (f) => !isBondSheetLabel(`${f.documentType || ""} ${f.name || ""}`),
  );
  const downloadable = files.filter((f) => f.documentId && f.version);
  const others = downloadable;

  const missing = docsLoading ? "กำลังโหลด…" : item ? "ไม่พบไฟล์" : "ยังไม่มีเอกสารที่ส่ง";
  const rowCls =
    "flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-xs font-semibold text-slate-900";
  const activeCls = "hover:bg-slate-50";
  const disabledCls = "cursor-not-allowed opacity-50";

  return (
    <aside className="sticky top-0 flex h-screen w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <div className="grid size-9 place-items-center rounded-full bg-brand-50 text-brand">
          <Icon name="info" className="size-[18px]" />
        </div>
        <div className="flex-1 leading-tight">
          <h2 className="font-bold text-slate-900">ข้อมูลตราสารหนี้</h2>
          <p className="text-xs text-slate-500">รายละเอียดโครงการและข้อกำหนด</p>
        </div>
        <button onClick={onClose} aria-label="ปิด" className="text-slate-400 hover:text-slate-700">
          <Icon name="close" className="size-5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <section className="rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold text-brand">รหัสอ้างอิงโครงการ</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{bond.code}</p>
            </div>
            <StatusBadge status={bond.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{bond.issuer}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
            <div>
              <p className="text-slate-500">มูลค่าเสนอขาย</p>
              <p className="mt-0.5 text-base font-bold text-slate-900">{bond.amount}</p>
            </div>
            <div>
              <p className="text-slate-500">อัตราดอกเบี้ย</p>
              <p className="mt-0.5 text-base font-bold text-brand">
                {bond.rate} <span className="text-xs font-normal text-slate-500">ต่อปี</span>
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
          <h3 className="mb-1 text-xs font-bold text-slate-900">ข้อกำหนดและแม่แบบ</h3>
          <DetailRow label="ประเภทตราสาร:" value={bond.type} />
          <DetailRow label="แม่แบบ (Template):" value={bond.template} />
          <DetailRow label="Version ล่าสุด:" value={bond.version} accent />
          <DetailRow label="วันที่สร้างร่าง:" value={bond.createdAt} />
          <DetailRow label="ผู้แก้ไขล่าสุด:" value={bond.editor} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-bold text-slate-900">เอกสารประกอบ</h3>
          <div className="space-y-2">
            <button
              type="button"
              disabled={!draftUrl}
              onClick={() =>
                draftUrl &&
                onPreview({ title: `${bond.code} ${bond.symbol} · ${latest?.version ?? ""}`, url: draftUrl })
              }
              className={`${rowCls} ${draftUrl ? activeCls : disabledCls}`}
            >
              <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand">
                <Icon name="doc" />
              </span>
              <span className="flex-1">
                เปิดดูฉบับร่างเต็ม (Preview Document)
                {!draftUrl && <span className="block text-[11px] font-normal text-slate-400">{missing}</span>}
              </span>
              <Icon name="external" className="size-4 text-slate-400" />
            </button>

            {draftUrl ? (
              <a
                href={draftUrl}
                download={`${bond.symbol || bond.code}-แบบข้อมูลตราสารหนี้.pdf`}
                className={`${rowCls} ${activeCls}`}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand">
                  <Icon name="doc" />
                </span>
                <span className="flex-1">ดาวน์โหลดแบบข้อมูลตราสารหนี้ (PDF)</span>
                <Icon name="download" className="size-4 text-slate-400" />
              </a>
            ) : (
              <button type="button" disabled className={`${rowCls} ${disabledCls}`}>
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand">
                  <Icon name="doc" />
                </span>
                <span className="flex-1">
                  ดาวน์โหลดแบบข้อมูลตราสารหนี้ (PDF)
                  <span className="block text-[11px] font-normal text-slate-400">{missing}</span>
                </span>
                <Icon name="download" className="size-4 text-slate-400" />
              </button>
            )}

            {others.map((f, i) => (
              <button
                key={`${f.name}-${i}`}
                type="button"
                onClick={() =>
                  onPreview({ title: f.documentType || f.name, url: docUrl(f.documentId!, f.version!) })
                }
                className={`${rowCls} ${activeCls}`}
              >
                <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand">
                  <Icon name="doc" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.documentType || f.name}</span>
                  <span className="block truncate text-[11px] font-normal text-slate-400">
                    {f.name} · {formatSize(f.size)}
                  </span>
                </span>
                <Icon name="external" className="size-4 text-slate-400" />
              </button>
            ))}
          </div>
        </section>

        <div className="flex gap-3 rounded-xl border border-orange-200 bg-brand-50 p-3">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand text-white">
            <Icon name="check" className="size-3" />
          </span>
          <div className="text-xs leading-snug">
            <p className="font-bold text-slate-900">ผ่านการสอบทานเบื้องต้น</p>
            <p className="mt-0.5 text-slate-600">
              ตรวจสอบความสอดคล้องกับระเบียบ ก.ล.ต. เรียบร้อยแล้ว
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 border-t border-slate-100 p-4">
        {canEdit ? (
          <Link
            href={editHref}
            className="grid h-10 flex-1 place-items-center rounded-lg bg-brand text-sm font-bold text-white hover:bg-brand-600"
          >
            แก้ไขข้อมูล
          </Link>
        ) : (
          <button
            type="button"
            disabled
            title="เจ้าหน้าที่ตรวจสอบไม่สามารถแก้ไขข้อมูลได้"
            className="h-10 flex-1 cursor-not-allowed rounded-lg bg-slate-100 text-sm font-bold text-slate-400"
          >
            แก้ไขข้อมูล
          </button>
        )}
        <button
          onClick={onClose}
          className="h-10 w-24 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          ปิด
        </button>
      </div>
    </aside>
  );
}

// หา id ของรายการจากค่า ?bond=... (รองรับทั้ง id และ code) ถ้าไม่พบใช้ค่าเริ่มต้นเดิม "1"
const resolveId = (param?: string) =>
  (param && bonds.find((b) => b.id === param || b.code === param)?.id) || "1";

export function BondList({ selectedBond }: { selectedBond?: string }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(() => resolveId(selectedBond));
  const session = useSession();
  // เจ้าหน้าที่ตรวจสอบ (role = officer) ห้ามกดแก้ไขข้อมูล
  // เช็กทั้ง role และ label (ชื่อที่แสดง เช่น "เจ้าหน้าที่ตรวจสอบ") เผื่อชื่อ field ไม่ตรงกัน
  const sess = session as unknown as { role?: string; label?: string } | null | undefined;
  const isOfficer = sess?.role === "officer" || /เจ้าหน้าที่/.test(sess?.label ?? "");
  const canEdit = !isOfficer;
  const approvals = useApprovals();
  const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  // โหลดคลังเอกสาร (PDF) ครั้งเดียว
  useEffect(() => {
    let active = true;
    fetch("/api/documents", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("โหลดคลังเอกสารไม่สำเร็จ");
        return res.json();
      })
      .then((result) => {
        if (active && Array.isArray(result.documents)) setStoredDocs(result.documents);
      })
      .catch((error) => console.error("Load document index error:", error))
      .finally(() => {
        if (active) setDocsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // เอกสารที่ผู้ใช้นี้มีสิทธิ์เห็น (บริษัท A เห็นเฉพาะของบริษัท A — กติกาเดียวกับหน้าประวัติการส่งเอกสาร)
  const scope = useMemo(() => (session ? allowedCompanies(session) : []), [session]);
  const scopedApprovals = useMemo(
    () =>
      scope === "all"
        ? approvals
        : approvals.filter((i) => isMine(i) || matchesCompany(companyOf(i), scope)),
    [approvals, scope],
  );

  // ถ้า URL เปลี่ยน ?bond=... (เช่น กดลิงก์จากหน้าอื่น) ให้เลือกรายการตามนั้น
  useEffect(() => {
    if (selectedBond) setSelectedId(resolveId(selectedBond));
  }, [selectedBond]);

  // แถวจากรายการที่ส่งเอกสาร (ตามสิทธิ์บริษัท) + ข้อมูล bonds เดิม
  // แสดงเฉพาะตราสารที่สถานะ "สมบูรณ์แล้ว" (complete) เท่านั้น
  const allBonds = useMemo(
    () => [...submissionBonds(scopedApprovals), ...bonds].filter((b) => b.status === "complete"),
    [scopedApprovals],
  );

  const filtered = useMemo(
    () =>
      allBonds.filter((b) => {
        const text = `${b.code} ${b.symbol} ${b.issuer}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (type === "all" || b.type.startsWith(type))
        );
      }),
    [allBonds, q, type],
  );

  const selected = allBonds.find((b) => b.id === selectedId) ?? null;
  const selectedItem = useMemo(
    () => (selected ? itemForBond(selected, scopedApprovals) : undefined),
    [selected, scopedApprovals],
  );

  return (
    <div className="flex min-h-full">
      <div className="min-w-0 flex-1 p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <h1 className="text-2xl font-bold leading-tight text-slate-900">รายการตราสารหนี้</h1>
            <span className="mt-1 rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold leading-tight text-brand">
              ระบบจัดเก็บเวอร์ชันปัจจุบัน
            </span>
          </div>
          {canEdit ? (
            <Link
              href={REVIEW_PATH}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white shadow-sm hover:bg-brand-600"
            >
              <Icon name="plus" /> สร้างรายการจาก Template
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="เจ้าหน้าที่ตรวจสอบไม่สามารถสร้างหรือแก้ไขรายการได้"
              className="inline-flex h-11 shrink-0 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-100 px-5 text-sm font-bold text-slate-400"
            >
              <Icon name="plus" /> สร้างรายการจาก Template
            </button>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ โครงการ / รหัสตราสาร..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-brand"
            />
          </div>
          <div className="mt-3 flex gap-3">
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="all">ทุกประเภท</option>
              <option value="ตราสารหลัก">ตราสารหลัก</option>
              <option value="Reopen">Reopen (รายการย่อย)</option>
              <option value="MTN">MTN (รายการย่อย)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-surface text-xs font-bold text-slate-600">
                <th className="px-4 py-4 text-left">รหัส/ชื่อตราสาร</th>
                <th className="px-4 py-4 text-left">ประเภท</th>
                <th className="px-4 py-4 text-left">TEMPLATE</th>
                <th className="px-4 py-4 text-left">VERSION ปัจจุบัน</th>
                <th className="px-4 py-4 text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const active = b.id === selectedId;
                return (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`cursor-pointer border-b border-slate-100 last:border-0 hover:bg-brand-50/60 ${
                      active ? "bg-brand-50 shadow-[inset_3px_0_0_var(--color-brand)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <p className={`text-xs font-bold ${active ? "text-brand" : "text-slate-800"}`}>
                        {b.code}
                      </p>
                      <p className={`text-xs font-bold ${active ? "text-brand" : "text-slate-800"}`}>
                        {b.symbol}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">{b.type}</td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">{b.template}</td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">{b.version}</td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    ไม่พบรายการที่ตรงกับเงื่อนไข
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <DetailPanel
          canEdit={canEdit}
          bond={selected}
          item={selectedItem}
          storedDocs={storedDocs}
          docsLoading={docsLoading}
          onPreview={setPreview}
          onClose={() => setSelectedId(null)}
        />
      )}
      {preview && <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
