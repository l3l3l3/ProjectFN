import { statusLabel, type BondStatus } from "@/data/bonds";

const styles: Record<BondStatus, string> = {
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-brand-50 text-brand border-orange-200",
  draft: "bg-slate-100 text-slate-600 border-slate-200",
};

export function StatusBadge({
  status,
  tone = "default",
}: {
  status: BondStatus;
  /** "rose" ใช้ในหน้ารอตรวจ/อนุมัติ ตามดีไซน์ */
  tone?: "default" | "rose";
}) {
  const cls =
    tone === "rose" && status === "pending"
      ? "bg-rose-50 text-rose-600 border-rose-200"
      : styles[status];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold leading-tight ${cls}`}
    >
      {statusLabel[status]}
    </span>
  );
}
