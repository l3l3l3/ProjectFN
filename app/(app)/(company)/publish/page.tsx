"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/shared/icon";

// ข้อมูลตัวอย่างตามดีไซน์ (รอเชื่อมข้อมูลจริงภายหลัง)
interface PublishedBond {
  id: number;
  issuer: string;
  symbol: string;
  type: string; // ประเภทหุ้นกู้
  credit: string; // อันดับเครดิต
  age: string; // อายุตราสาร (ใช้กรอง)
  rate: string;
  dueDate: string;
  amount: string;
  docs: number;
}

const TYPES = ["หุ้นกู้ไม่มีหลักประกัน", "หุ้นกู้มีหลักประกัน", "หุ้นกู้ด้อยสิทธิ", "หุ้นกู้แปลงสภาพ"];
const CREDITS = ["A", "AA", "BBB+", "A-"];
const AGES = ["ไม่เกิน 1 ปี", "1 - 3 ปี", "3 - 5 ปี", "มากกว่า 5 ปี"];
const SYMBOLS = ["XXX26OA", "XXX27NA", "XXX25DA", "XXX28CA"];
const DOCS = [5, 4, 3, 6];

const bonds: PublishedBond[] = Array.from({ length: 48 }, (_, i) => ({
  id: i + 1,
  issuer: `บริษัท ตัวอย่าง ${i + 1} จำกัด (มหาชน)`,
  symbol: i < 4 ? SYMBOLS[i] : `XXX${25 + (i % 4)}${String.fromCharCode(65 + (i % 26))}A`,
  type: TYPES[i % 4],
  credit: CREDITS[i % 4],
  age: AGES[i % 4],
  rate: "x.xx% ต่อปี",
  dueDate: "dd/mm/yyyy",
  amount: "xxx ล้านบาท",
  docs: DOCS[i % 4],
}));

const selectCls =
  "h-14 appearance-none rounded-md border border-slate-300 bg-white py-0 pl-4 pr-10 text-slate-900 outline-none focus:border-slate-900";

function Select({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={selectCls}
      >
        <option value="all">{label}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <Icon
        name="chevron"
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg text-slate-900">{value}</p>
    </div>
  );
}

function DetailDialog({ bond, onClose }: { bond: PublishedBond; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`รายละเอียด ${bond.issuer}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-md border-2 border-navy bg-white p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold leading-snug text-slate-900">{bond.issuer}</h2>
            <p className="mt-1 text-slate-600">ตราสาร: {bond.symbol}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="text-slate-500 hover:text-slate-900"
          >
            <Icon name="close" className="size-6" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-navy px-4 py-1.5 text-slate-900">
            {bond.type}
          </span>
          <span className="rounded-full border border-navy px-4 py-1.5 text-slate-900">
            เครดิต {bond.credit}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t-2 border-slate-200 pt-5">
          <Field label="อัตราดอกเบี้ย" value={bond.rate} />
          <Field label="วันครบกำหนด" value={bond.dueDate} />
          <Field label="มูลค่าที่ออก" value={bond.amount} />
          <Field label="เอกสาร" value={`${bond.docs} ฉบับ`} />
          <Field label="ประเภทหุ้นกู้" value={bond.type} />
          <Field label="อันดับเครดิต" value={bond.credit} />
          <Field label="อายุตราสาร" value={bond.age} />
        </div>

        <div className="mt-6 border-t-2 border-slate-200 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="h-14 w-full rounded-md bg-navy text-lg text-white hover:bg-navy-soft"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [credit, setCredit] = useState("all");
  const [age, setAge] = useState("all");
  const [selected, setSelected] = useState<PublishedBond | null>(null);

  const filtered = useMemo(
    () =>
      bonds.filter((b) => {
        const text = `${b.issuer} ${b.symbol}`.toLowerCase();
        return (
          (!q || text.includes(q.toLowerCase())) &&
          (type === "all" || b.type === type) &&
          (credit === "all" || b.credit === credit) &&
          (age === "all" || b.age === age)
        );
      }),
    [q, type, credit, age],
  );

  return (
    <div className="min-h-full bg-white">
      <section className="bg-slate-100 px-6 pb-12 pt-14 text-center lg:px-8">
        <h1 className="text-4xl font-bold text-slate-900">ข้อมูลตราสารหนี้และหุ้นกู้</h1>
        <p className="mt-5 text-lg text-slate-600">ค้นหาและตรวจสอบรายละเอียดตราสารหนี้ของแต่ละบริษัท</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(input.trim());
          }}
          className="mx-auto mt-8 flex max-w-4xl gap-4"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ค้นหาชื่อบริษัทผู้ออก / ชื่อตราสาร / รหัสตราสาร"
            className="h-14 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 text-lg text-slate-900 outline-none placeholder:text-slate-500 focus:border-slate-900"
          />
          <button
            type="submit"
            className="h-14 shrink-0 rounded-md bg-navy px-7 text-lg text-white hover:bg-navy-soft"
          >
            ค้นหา
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Select value={type} onChange={setType} label="ประเภทตราสาร" options={TYPES} />
          <Select value={credit} onChange={setCredit} label="อันดับเครดิต" options={CREDITS} />
          <Select value={age} onChange={setAge} label="อายุตราสาร" options={AGES} />
        </div>
      </section>

      <section className="px-6 py-8 lg:px-8">
        <p className="text-slate-600">พบ {filtered.length} รายการ</p>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">ไม่พบรายการที่ตรงกับเงื่อนไข</div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((b) => (
              <article key={b.id} className="rounded-md border-2 border-navy bg-white p-5">
                <h2 className="text-xl font-bold leading-snug text-slate-900">{b.issuer}</h2>
                <p className="mt-1 text-slate-600">ตราสาร: {b.symbol}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-navy px-4 py-1.5 text-slate-900">
                    {b.type}
                  </span>
                  <span className="rounded-full border border-navy px-4 py-1.5 text-slate-900">
                    เครดิต {b.credit}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t-2 border-slate-200 pt-5">
                  <Field label="อัตราดอกเบี้ย" value={b.rate} />
                  <Field label="วันครบกำหนด" value={b.dueDate} />
                  <Field label="มูลค่าที่ออก" value={b.amount} />
                  <Field label="เอกสาร" value={`${b.docs} ฉบับ`} />
                </div>

                <div className="mt-5 border-t-2 border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={() => setSelected(b)}
                    className="h-14 w-full rounded-md bg-navy text-lg text-white hover:bg-navy-soft"
                  >
                    ดูรายละเอียด
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selected && <DetailDialog bond={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
