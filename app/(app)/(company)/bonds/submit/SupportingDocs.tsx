'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { formatSize } from './bond-config'

/* ---------- เอกสารที่ต้องแนบ (ชื่อเป็นตัวอย่าง แก้ได้) ---------- */
export type DocSlot = { key: string; label: string; required: boolean }

export const DOC_SLOTS: DocSlot[] = [
  { key: 'prospectus', label: 'หนังสือชี้ชวน / ข้อกำหนดสิทธิของตราสาร', required: true },
  { key: 'company-cert', label: 'สำเนาหนังสือรับรองบริษัท (ลงนามรับรองสำเนาถูกต้อง)', required: true },
  { key: 'id-card', label: 'สำเนาบัตรประจำตัวประชาชนของผู้มีอำนาจลงนาม (ลงนามรับรองสำเนาถูกต้อง)', required: true },
  { key: 'resolution', label: 'สำเนามติที่ประชุมคณะกรรมการ / ผู้ถือหุ้น (ลงนามรับรองสำเนาถูกต้อง)', required: true },
  { key: 'poa', label: 'สำเนาหนังสือมอบอำนาจ (กรณีมีการมอบอำนาจ)', required: false },
]

export const MAX_PDF_MB = 4

type SupportingDocsProps = {
  files: Record<string, File | null>
  onChange: (key: string, file: File | null) => void
}

export default function SupportingDocs({ files, onChange }: SupportingDocsProps) {
  // ข้อความผิดพลาดของแต่ละช่อง (ข้อความว่าง = ไม่มีข้อผิดพลาด)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setError = (key: string, message: string) =>
    setErrors((prev) => ({ ...prev, [key]: message }))

  const handlePick = (slot: DocSlot, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // เคลียร์ค่า เพื่อให้เลือกไฟล์เดิมซ้ำได้
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError(slot.key, 'รองรับเฉพาะไฟล์ .pdf')
      return
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setError(slot.key, `ไฟล์มีขนาดเกิน ${MAX_PDF_MB} MB`)
      return
    }

    setError(slot.key, '')
    onChange(slot.key, file)
  }

  const handleRemove = (slot: DocSlot) => {
    setError(slot.key, '')
    onChange(slot.key, null)
  }

  return (
    <div>
      {/* ---- อัปโหลดเอกสาร ---- */}
      <h3 className="border-b border-slate-200 pb-2 text-sm font-bold text-slate-900">อัปโหลดเอกสาร</h3>

      <div className="mt-4 space-y-5">
        {DOC_SLOTS.map((slot) => {
          const file = files[slot.key] ?? null
          const error = errors[slot.key]

          return (
            <div key={slot.key}>
              <p className="text-xs font-semibold text-slate-800">
                {slot.label}
                {slot.required && <span className="ml-0.5 text-red-500">*</span>}
              </p>

              <div className="mt-1.5 flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1.5">
                {/* ปุ่มเลือกไฟล์ = label ที่ครอบ input ซ่อนไว้ (คลิกแล้วเปิดหน้าต่างเลือกไฟล์) */}
                <label className="inline-flex shrink-0 cursor-pointer items-center rounded bg-brand px-3 py-1.5 text-xs font-medium text-white transition focus-within:ring-2 focus-within:ring-orange-200 hover:bg-brand-600">
                  เลือกไฟล์
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={(e) => handlePick(slot, e)}
                  />
                </label>

                <span
                  className={`min-w-0 flex-1 truncate text-xs ${file ? 'text-slate-800' : 'text-slate-400'}`}
                >
                  {file ? file.name : 'ยังไม่ได้เลือกไฟล์'}
                </span>

                {file && (
                  <>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(slot)}
                      aria-label={`ลบไฟล์ ${file.name}`}
                      className="shrink-0 px-1 text-red-500 transition hover:text-red-700"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {error ? (
                <p className="mt-1 text-xs text-red-600">{error}</p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  เฉพาะไฟล์ .pdf ขนาดไฟล์ไม่เกิน {MAX_PDF_MB} MB
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}