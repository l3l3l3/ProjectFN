"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { addApproval } from "@/lib/approvals-store";
import { useSession } from "@/lib/use-session";
import { allowedCompanies } from "@/lib/company-access";

const templates = [
  {
    id: "A",
    no: "01",
    title: "Template A : MTN ตราสารหลัก",
    sub: "Standard Senior Unsecured",
    subColor: "text-brand",
    desc: "เหมาะสำหรับหุ้นกู้ทั่วไปไม่ด้อยสิทธิ ไม่มีประกัน มีผู้แทนผู้ถือหุ้นกู้ รองรับแบบ Filing 69-Base",
    foot: "ครบกำหนดไถ่ถอน: 3-5 ปี",
    badge: "ใช้งานบ่อยที่สุด",
    summary: "Template A (MTN Corporate)",
  },
  {
    id: "B",
    no: "02",
    title: "Template B : Reopen Series",
    sub: "Additional Tranche Issuance",
    subColor: "text-slate-600",
    desc: "สำหรับการเสนอขายเพิ่มเติมในรุ่นเดิม รวมสิทธิและเงื่อนไขเข้ากับชุดเดิมที่จดทะเบียนแล้ว",
    foot: "เชื่อมโยงชุดเดิม",
    summary: "Template B (Reopen Series)",
  },
  {
    id: "C",
    no: "03",
    title: "Template C : ESG / Green Bond",
    sub: "Sustainable Framework",
    subColor: "text-emerald-600",
    desc: "พร้อมฟอร์มรายงานการใช้เงินสีเขียว และเอกสาร Second-Party Opinion (SPO) มาตรฐานสากล",
    foot: "กรอบความยั่งยืน",
    summary: "Template C (ESG / Green Bond)",
  },
] as const;

const initial = {
  name: "หุ้นกู้ของ บริษัท โรสโกลด์ โฮลดิ้งส์ จำกัด (มหาชน) ครั้งที่ 1/2569 ครบกำหนดไถ่ถอนปี พ.ศ. 2572",
  symbol: "RGH295A",
  amount: "2,500,000,000",
  rate: "3.85",
  target: "ผู้ลงทุนสถาบัน และ/หรือ ผู้ลงทุนรายใหญ่ (II&HW)",
  issueDate: "2026-03-15",
  maturityDate: "2029-03-15",
  offering: "public",
};

type Form = typeof initial;
type Errors = Partial<Record<keyof Form, string>>;

const inputCls =
  "h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20";

function Field({
  label,
  required,
  error,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-bold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

export function CreateFromTemplate() {
  const router = useRouter();
  const [tpl, setTpl] = useState<(typeof templates)[number]["id"]>("A");
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [toast, setToast] = useState("");
  const [savedAt, setSavedAt] = useState("18:45");

  // บริษัทที่ผู้ใช้นี้มีสิทธิ์ส่งเอกสารแทน (ตัวแทนบริษัทจะเห็นเฉพาะบริษัทที่ได้รับสิทธิ์)
  const session = useSession();
  const companyOptions = useMemo(() => {
    const scope = session ? allowedCompanies(session) : [];
    return scope === "all" ? [] : scope;
  }, [session]);
  const [company, setCompany] = useState("");
  const [companyError, setCompanyError] = useState("");
  // ถ้ามีสิทธิ์แค่บริษัทเดียวให้เลือกให้อัตโนมัติ
  const selectedCompany = company || (companyOptions.length === 1 ? companyOptions[0] : "");

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = "กรุณากรอกชื่อตราสารหนี้";
    if (!form.symbol.trim()) e.symbol = "กรุณากรอกชื่อย่อ";
    if (!form.amount.trim()) e.amount = "กรุณากรอกวงเงิน";
    if (!form.rate.trim()) e.rate = "กรุณากรอกอัตราดอกเบี้ย";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const saveDraft = () => {
    const now = new Date();
    setSavedAt(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    );
    flash("บันทึกฉบับร่างแล้ว");
  };

  const next = () => {
    const formOk = validate();
    if (!selectedCompany) setCompanyError("กรุณาเลือกบริษัทที่ส่งเอกสารแทน");
    if (!formOk || !selectedCompany) return flash("กรุณาระบุข้อมูลให้ครบถ้วน");

    // บันทึกเข้า store กลาง เพื่อให้ขึ้นในหน้าประวัติการส่งเอกสาร / หน้าอนุมัติ
    const issuer = `บริษัท ${selectedCompany}`;
    const symbol = form.symbol.trim();
    addApproval({
      title: `${symbol} — ${issuer}`,
      issuer,
      symbol,
      bondData: { template: tpl, ...form, issuer },
      docType: current.summary,
      detail: form.name.trim(),
      files: [],
    });

    flash("ส่งตรวจสอบเรียบร้อย");
    setTimeout(() => router.push("/tracking/history"), 900);
  };

  const current = templates.find((t) => t.id === tpl)!;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4 lg:px-8">
        <h1 className="text-xl font-bold text-slate-900">
          สร้างรายการด้วยเทมเพลต <span className="text-brand">MTN-2026-A1</span>
        </h1>
        <span className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand">
          เวอร์ชันเทมเพลต v2.4
        </span>
      </header>

      <div className="flex-1 space-y-6 p-6 lg:p-8">
        {/* 1. เลือกเทมเพลต */}
        <section>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900">1. เลือกเทมเพลตมาตรฐานสำหรับรายการใหม่</h2>
              <p className="text-xs text-slate-500">
                เลือกเทมเพลตที่จัดเตรียมไว้เพื่อโหลดโครงสร้างเอกสารและข้อกำหนดสิทธิอัตโนมัติ
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand">
              เลือกแล้ว: {current.summary}
            </span>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {templates.map((t) => {
              const active = t.id === tpl;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTpl(t.id)}
                  aria-pressed={active}
                  className={`relative rounded-2xl border bg-white p-5 text-left shadow-sm transition-all ${
                    active
                      ? "border-brand ring-1 ring-brand"
                      : "border-slate-200 hover:border-brand/50"
                  }`}
                >
                  {"badge" in t && (
                    <span className="absolute -top-2.5 right-4 rounded-md bg-brand px-2.5 py-0.5 text-[10px] font-bold text-white">
                      {t.badge}
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
                        active ? "bg-brand-50 text-brand" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.no}
                    </span>
                    <div className="leading-tight">
                      <p className="text-sm font-bold text-slate-900">{t.title}</p>
                      <p className={`mt-0.5 text-xs font-semibold ${t.subColor}`}>{t.sub}</p>
                    </div>
                  </div>
                  <p className="mt-3 min-h-[48px] text-xs leading-relaxed text-slate-600">{t.desc}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="text-slate-500">
                      {t.foot.includes(":") ? (
                        <>
                          {t.foot.split(":")[0]}:{" "}
                          <b className="text-slate-900">{t.foot.split(":")[1]}</b>
                        </>
                      ) : (
                        t.foot
                      )}
                    </span>
                    {active ? (
                      <span className="flex items-center gap-1 font-semibold text-brand">
                        <Icon name="check" className="size-3.5" /> เลือกอยู่
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-500">คลิกเลือก</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. ข้อมูลตั้งต้น */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900">2. ข้อมูลตั้งต้นของรายการตราสารใหม่</h2>
              <p className="text-xs text-slate-500">
                ข้อมูลจะถูกส่งไปยังขั้นตอนจัดพิมพ์ร่างหนังสือชี้ชวนและหนังสือค้ำประกัน
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-500">
              * ระบุข้อมูลให้ครบถ้วน
            </span>
          </div>

          <div className="mt-5 grid gap-x-5 gap-y-4 border-t border-slate-100 pt-5 lg:grid-cols-3">
            <Field
              label="ส่งเอกสารในนามบริษัท"
              required
              error={companyError}
              className="lg:col-span-3"
            >
              <select
                value={selectedCompany}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setCompanyError("");
                }}
                className={`${inputCls} ${companyError ? "border-rose-400" : "border-slate-200"} lg:max-w-md`}
              >
                <option value="" disabled>
                  {companyOptions.length === 0 ? "ยังไม่ได้รับสิทธิ์ส่งแทนบริษัทใด" : "— เลือกบริษัท —"}
                </option>
                {companyOptions.map((c) => (
                  <option key={c} value={c}>
                    {`บริษัท ${c}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="ชื่อตราสารหนี้ (ภาษาไทย)"
              required
              error={errors.name}
              className="lg:col-span-2"
            >
              <input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={`${inputCls} ${errors.name ? "border-rose-400" : "border-slate-200"}`}
              />
            </Field>
            <Field label="ชื่อย่อตราสาร (Symbol)" required error={errors.symbol}>
              <input
                value={form.symbol}
                onChange={(e) => set("symbol", e.target.value)}
                className={`${inputCls} font-mono font-semibold text-brand ${
                  errors.symbol ? "border-rose-400" : "border-slate-200"
                }`}
              />
            </Field>

            <Field label="วงเงินเสนอขายรวม (บาท)" required error={errors.amount}>
              <div className="relative">
                <input
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  inputMode="numeric"
                  className={`${inputCls} pr-14 font-semibold ${
                    errors.amount ? "border-rose-400" : "border-slate-200"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-400">
                  THB
                </span>
              </div>
            </Field>
            <Field label="อัตราดอกเบี้ยคงที่ (% ต่อปี)" required error={errors.rate}>
              <div className="relative">
                <input
                  value={form.rate}
                  onChange={(e) => set("rate", e.target.value)}
                  inputMode="decimal"
                  className={`${inputCls} pr-16 font-semibold text-brand ${
                    errors.rate ? "border-rose-400" : "border-slate-200"
                  }`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                  % ต่อปี
                </span>
              </div>
            </Field>
            <Field label="กลุ่มผู้ลงทุนเป้าหมาย">
              <input
                value={form.target}
                onChange={(e) => set("target", e.target.value)}
                className={`${inputCls} border-slate-200`}
              />
            </Field>

            <Field label="วันออกตราสาร (Issue Date)">
              <input
                type="date"
                value={form.issueDate}
                onChange={(e) => set("issueDate", e.target.value)}
                className={`${inputCls} border-slate-200`}
              />
            </Field>
            <Field label="วันครบกำหนดไถ่ถอน (Maturity Date)">
              <input
                type="date"
                value={form.maturityDate}
                min={form.issueDate}
                onChange={(e) => set("maturityDate", e.target.value)}
                className={`${inputCls} border-slate-200`}
              />
            </Field>
            <Field label="ประเภทการเสนอขายหนี้">
              <select
                value={form.offering}
                onChange={(e) => set("offering", e.target.value)}
                className={`${inputCls} border-slate-200`}
              >
                <option value="public">เสนอขายต่อประชาชนทั่วไป / ผู้ลงทุนสถาบัน</option>
                <option value="ii">เสนอขายต่อผู้ลงทุนสถาบัน (II)</option>
                <option value="iihw">เสนอขายต่อ II และ HNW</option>
              </select>
            </Field>
          </div>

          <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              ผูกโยงข้อกำหนดสิทธิตามมาตรฐานจาก Template {tpl} อัตโนมัติ
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              ส่งแจ้งเตือนนิติบุคคลจัดการกองทุนและผู้ถือหุ้นกู้
            </li>
          </ul>
        </section>
      </div>

      {/* Sticky action bar */}
      <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3 lg:px-8">
        <p className="flex items-center gap-2 text-xs text-slate-600">
          <span className="size-2 rounded-full bg-emerald-500" />
          บันทึกสถานะร่างอัตโนมัติล่าสุดเมื่อ <b>{savedAt} น.</b>
        </p>
        <div className="flex items-center gap-3">
          {toast && (
            <span role="status" className="text-xs font-semibold text-brand">
              {toast}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setForm(initial);
              setErrors({});
              router.push("/bonds");
            }}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ยกเลิก / ล้างฟอร์ม
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            บันทึกฉบับร่าง (Save Draft)
          </button>
          <button
            type="button"
            onClick={next}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white hover:bg-brand-600"
          >
            ถัดไป: ตรวจสอบและส่งอนุมัติ <Icon name="arrowRight" />
          </button>
        </div>
      </footer>
    </div>
  );
}
