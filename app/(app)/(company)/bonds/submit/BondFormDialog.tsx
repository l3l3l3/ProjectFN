'use client'

import { useEffect, useState } from 'react'
import {
  FIELD_GROUPS,
  FIELD_KEYS,
  computeTerm,
  makeRowId,
  validateBond,
} from './bond-config'
import type { AmortRow, BondData, FieldDef, FieldGroup, TemplateDef } from './bond-config'

/* ---------- สไตล์ช่องกรอก ---------- */
const inputBase =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-900 outline-none transition ' +
  'placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-orange-100'
const inputError = 'border-red-400 focus:border-red-400 focus:ring-red-100'

// แสดงชื่อภาษาอังกฤษ ตามด้วยคำแปลภาษาไทยในวงเล็บ (ตัวบางสีเทา)
function LabelText({ en, th }: { en: string; th?: string }) {
  return (
    <>
      {en}
      {th && <span className="font-normal text-slate-500"> ({th})</span>}
    </>
  )
}

// จำนวนคอลัมน์ของกลุ่มแบบ "row" ตามจำนวนช่อง (เขียนเป็นข้อความเต็มเพื่อให้ Tailwind มองเห็น)
const ROW_COLS: Record<number, string> = {
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
  5: 'sm:grid-cols-3 lg:grid-cols-5',
}

/* ---------- ช่องกรอกหนึ่งช่อง (เลือกชนิดตาม def.type) ---------- */
function Control({
  def,
  value,
  error,
  onChange,
}: {
  def: FieldDef
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  const id = `f-${def.key}`
  const cls = `${inputBase} ${error ? inputError : ''}`
  const common = { id, 'aria-invalid': error ? true : undefined }

  if (def.type === 'select') {
    return (
      <select
        {...common}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${cls} ${value ? '' : 'text-slate-400'}`}
      >
        <option value="">เลือก</option>
        {def.options?.map((o) => (
          <option key={o} value={o} className="text-slate-900">
            {o}
          </option>
        ))}
      </select>
    )
  }

  if (def.type === 'textarea') {
    return (
      <textarea
        {...common}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.placeholder}
        className={`${cls} resize-y`}
      />
    )
  }

  return (
    <input
      {...common}
      type={def.type === 'number' ? 'number' : def.type === 'date' ? 'date' : 'text'}
      {...(def.type === 'number' ? { min: 0, step: 'any', inputMode: 'decimal' as const } : {})}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={def.placeholder}
      className={cls}
    />
  )
}

/* ---------- แบบ "pairs": ป้ายสีเทาด้านซ้าย + ช่องกรอกด้านขวา เหมือนตารางในรูปที่ 3 ---------- */
function PairCell({
  def,
  value,
  error,
  computedText,
  onChange,
}: {
  def: FieldDef
  value: string
  error?: string
  computedText: string
  onChange: (value: string) => void
}) {
  return (
    <div
      className={`grid grid-cols-1 bg-white sm:grid-cols-[13rem_1fr] ${def.wide ? 'lg:col-span-2' : ''}`}
    >
      <label
        htmlFor={`f-${def.key}`}
        className="bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700 sm:flex sm:items-center"
      >
        <span>
          <LabelText en={def.label} th={def.labelTh} />
          {def.required && <span className="ml-0.5 text-red-500">*</span>}
        </span>
      </label>

      <div className="p-2">
        {def.type === 'computed' ? (
          <div className="rounded-md bg-slate-50 px-2.5 py-2 text-sm text-slate-700">{computedText}</div>
        ) : (
          <Control def={def} value={value} error={error} onChange={onChange} />
        )}
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {def.hint && !error && <p className="mt-1 text-[11px] text-slate-400">{def.hint}</p>}
      </div>
    </div>
  )
}

/* ---------- แบบ "row": หัวข้อสีเทา + หลายช่องเรียงกันในแถวเดียว ---------- */
function RowGroup({
  group,
  values,
  errors,
  onChange,
}: {
  group: FieldGroup
  values: Record<string, string>
  errors: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <h3 className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
        <LabelText en={group.title} th={group.titleTh} />
      </h3>
      <div className={`grid grid-cols-1 gap-3 p-3 ${ROW_COLS[group.fields.length] ?? 'sm:grid-cols-2'}`}>
        {group.fields.map((def) => (
          <div key={def.key}>
            <label htmlFor={`f-${def.key}`} className="mb-1 block text-[11px] font-medium text-slate-600">
              <LabelText en={def.label} th={def.labelTh} />
            </label>
            <Control
              def={def}
              value={values[def.key] ?? ''}
              error={errors[def.key]}
              onChange={(v) => onChange(def.key, v)}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Amortized Schedule: เพิ่ม/ลบแถวได้ ---------- */
function AmortizedEditor({
  rows,
  onChange,
}: {
  rows: AmortRow[]
  onChange: (rows: AmortRow[]) => void
}) {
  const update = (id: string, patch: Partial<AmortRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between bg-slate-100 px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-700">
          <LabelText en="Amortized Schedule" th="ตารางการทยอยจ่ายคืนเงินต้น" />
        </h3>
        <button
          type="button"
          onClick={() => onChange([...rows, { id: makeRowId(), couponDate: '', principal: '' }])}
          className="rounded-md border border-orange-300 bg-white px-2.5 py-1 text-xs font-medium text-brand-600 transition hover:bg-brand-50"
        >
          + เพิ่มแถว
        </button>
      </div>

      <div className="p-3">
        {rows.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-400">
            ยังไม่มีรายการ (ไม่ต้องกรอกถ้าไม่มีการทยอยจ่ายคืนเงินต้น)
          </p>
        ) : (
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_2rem] gap-3 text-[11px] font-medium text-slate-500 sm:grid">
              <span>
                <LabelText en="Coupon Date" th="วันจ่ายดอกเบี้ย" />
              </span>
              <span>
                <LabelText en="Principal Amount" th="จำนวนเงินต้น" />
              </span>
              <span />
            </div>

            {rows.map((row, i) => (
              <div
                key={row.id}
                className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_2rem] sm:items-center sm:gap-3"
              >
                <input
                  type="date"
                  aria-label={`Coupon Date แถวที่ ${i + 1}`}
                  value={row.couponDate}
                  onChange={(e) => update(row.id, { couponDate: e.target.value })}
                  className={inputBase}
                />
                <input
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  aria-label={`Principal Amount แถวที่ ${i + 1}`}
                  placeholder="0.00"
                  value={row.principal}
                  onChange={(e) => update(row.id, { principal: e.target.value })}
                  className={inputBase}
                />
                <button
                  type="button"
                  aria-label={`ลบแถวที่ ${i + 1}`}
                  onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                  className="text-sm text-red-500 transition hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ---------- หน้าต่างกรอกข้อมูลแบบเต็มจอ ---------- */
type BondFormDialogProps = {
  template: TemplateDef
  initial: BondData              // ข้อมูลตั้งต้น (ค่าของเทมเพลต หรือข้อมูลที่เคยบันทึกไว้)
  onSave: (data: BondData) => void
  onClose: () => void
}

export default function BondFormDialog({ template, initial, onSave, onClose }: BondFormDialogProps) {
  // แก้ไขบนสำเนา (draft) จะได้ยกเลิกแล้วข้อมูลเดิมไม่เปลี่ยน
  const [draft, setDraft] = useState<BondData>(initial)
  const [attempted, setAttempted] = useState(false) // เคยกดบันทึกแล้วหรือยัง (เริ่มแสดงข้อผิดพลาดหลังจากนั้น)

  const errors: Record<string, string> = attempted ? validateBond(draft) : {}
  const errorCount = Object.keys(errors).length
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)

  const setValue = (key: string, value: string) =>
    setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } }))

  // ล็อกการเลื่อนของหน้าด้านหลังตอนหน้าต่างเปิดอยู่
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // กด Esc เพื่อปิด (ถ้ามีการแก้ไขจะถามก่อน)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (dirty && !window.confirm('ปิดโดยไม่บันทึก? ข้อมูลที่แก้ไขจะหายไป')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, onClose])

  const requestClose = () => {
    if (dirty && !window.confirm('ปิดโดยไม่บันทึก? ข้อมูลที่แก้ไขจะหายไป')) return
    onClose()
  }

  const handleSave = () => {
    const found = validateBond(draft)
    if (Object.keys(found).length > 0) {
      setAttempted(true)
      // เลื่อนไปและโฟกัสช่องแรกที่ผิด (ตามลำดับในฟอร์ม)
      const firstKey = FIELD_KEYS.find((k) => found[k])
      if (firstKey) {
        const el = document.getElementById(`f-${firstKey}`)
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        el?.focus({ preventScroll: true })
      }
      return
    }
    onSave(draft)
  }

  // แถบหัวข้อสีเหลืองด้านบน อัปเดตตามที่กรอก (เหมือนในรูปที่ 3)
  const banner = `${draft.values.symbol || 'SYMBOL'} : ${
    draft.values.nameEnglish || draft.values.issuer || 'ชื่อตราสาร'
  }`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bond-dialog-title"
      className="fixed inset-0 z-[100] flex flex-col bg-slate-50"
    >
      {/* หัวหน้าต่าง */}
      <header className="flex items-center justify-between gap-3 border-b border-orange-100 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 id="bond-dialog-title" className="truncate text-base font-bold text-slate-900">
            กรอกข้อมูลตราสารหนี้
          </h2>
          <p className="truncate text-xs text-slate-500">
            เทมเพลต: {template.name} ({template.subtitle})
          </p>
        </div>
        <button
          type="button"
          onClick={requestClose}
          aria-label="ปิดหน้าต่าง"
          className="rounded-md px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </header>

      {/* เนื้อหาเลื่อนได้ */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
          {attempted && errorCount > 0 && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
              กรุณากรอกข้อมูลที่จำเป็นให้ครบและถูกต้อง ({errorCount} รายการ)
            </div>
          )}

          <div className="rounded-lg border border-amber-300 bg-amber-100/70 px-4 py-3 text-sm font-bold text-slate-900">
            {banner}
          </div>

          {FIELD_GROUPS.map((group) => {
            if (group.layout === 'pairs') {
              return (
                <section key={group.title}>
                  <h3 className="mb-2 text-sm font-bold text-slate-800">
                    <LabelText en={group.title} th={group.titleTh} />
                  </h3>
                  {/* gap-px + พื้นหลังเทา = เส้นบาง ๆ คั่นระหว่างช่อง */}
                  <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-2">
                    {group.fields.map((def) => (
                      <PairCell
                        key={def.key}
                        def={def}
                        value={draft.values[def.key] ?? ''}
                        error={errors[def.key]}
                        computedText={computeTerm(draft.values.issueDate, draft.values.maturityDate)}
                        onChange={(v) => setValue(def.key, v)}
                      />
                    ))}
                  </div>
                </section>
              )
            }

            if (group.layout === 'row') {
              return (
                <RowGroup
                  key={group.title}
                  group={group}
                  values={draft.values}
                  errors={errors}
                  onChange={setValue}
                />
              )
            }

            return (
              <AmortizedEditor
                key={group.title}
                rows={draft.amortized}
                onChange={(rows) => setDraft((d) => ({ ...d, amortized: rows }))}
              />
            )
          })}
        </div>
      </div>

      {/* แถบปุ่มด้านล่าง (ติดขอบล่างเสมอ) */}
      <footer className="flex items-center justify-between gap-3 border-t border-orange-100 bg-white px-4 py-3 sm:px-6">
        <p className="text-xs text-slate-400">
          <span className="text-red-500">*</span> จำเป็นต้องกรอก
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-orange-200 bg-white px-5 py-2 text-sm text-brand-600 shadow-sm transition hover:bg-brand-50"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            บันทึกข้อมูล
          </button>
        </div>
      </footer>
    </div>
  )
}