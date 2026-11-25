'use client'

import { useEffect, useState } from 'react'
import { PrintPortal, ReceiptDocument } from '@/app/(app)/(company)/bonds/submit/ReceiptDocument'
import type { ReceiptInfo } from '@/app/(app)/(company)/bonds/submit/ReceiptDocument'
import { formatSize } from '@/app/(app)/(company)/bonds/submit/bond-config'
import type { BondData } from '@/app/(app)/(company)/bonds/submit/bond-config'

/* ---------- ชนิดข้อมูล ----------
   เขียนแบบ "โครงสร้าง" ไม่ import จากไฟล์ store โดยตรง
   ApprovalItem ของ store ส่งเข้ามาได้เลย (ไม่ว่า store จะอยู่โฟลเดอร์ไหน) */
type StoredReceipt = {
  docNo: string
  issuedAt: string // วันเวลาออกเอกสารรูปแบบ ISO (เก็บใน localStorage เป็นข้อความ)
  templateName: string
  submitter: string
  data: BondData
  attachments: { label: string; name: string; size: number }[]
}

export type ViewableItem = {
  id: number
  title: string
  docType?: string
  status: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
  files?: { name: string; size: number }[]
  receipt?: StoredReceipt
}

type ReceiptViewerDialogProps = {
  item: ViewableItem
  onClose: () => void
  onApprove?: () => void // ไม่ส่ง = ไม่แสดงปุ่ม (เช่นรายการที่ตัดสินแล้ว)
  onReject?: () => void
}

const STATUS_META = {
  pending: { label: 'รอดำเนินการ', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', badge: 'bg-green-100 text-green-700' },
  rejected: { label: 'ไม่อนุมัติ', badge: 'bg-red-100 text-red-700' },
} as const

// ข้อมูลที่เก็บไว้ (ข้อความ) -> ข้อมูลที่ ReceiptDocument ใช้ (มี Date)
const toReceiptInfo = (r: StoredReceipt): ReceiptInfo => ({ ...r, issuedAt: new Date(r.issuedAt) })

export default function ReceiptViewerDialog({ item, onClose, onApprove, onReject }: ReceiptViewerDialogProps) {
  const [printing, setPrinting] = useState(false)

  const receipt = item.receipt ? toReceiptInfo(item.receipt) : null
  const docNo = item.receipt?.docNo
  const status = STATUS_META[item.status]

  // ล็อกการเลื่อนของหน้าด้านหลังตอนหน้าต่างเปิดอยู่
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // กด Esc เพื่อปิด
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !printing) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, printing])

  // ดาวน์โหลด = เปิดหน้าต่างพิมพ์ของเบราว์เซอร์ (เลือก Save as PDF) ชื่อไฟล์ใช้เลขที่เอกสาร
  useEffect(() => {
    if (!printing) return

    const previousTitle = document.title
    document.title = docNo ?? item.title

    const finish = () => setPrinting(false)
    window.addEventListener('afterprint', finish, { once: true })
    const timer = setTimeout(() => window.print(), 100)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', finish)
      document.title = previousTitle
    }
  }, [printing, docNo, item.title])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-viewer-title"
      className="fixed inset-0 z-[100] flex flex-col bg-slate-100"
    >
      {/* หัวหน้าต่าง */}
      <header className="flex items-center justify-between gap-3 border-b border-orange-100 bg-white px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h2 id="receipt-viewer-title" className="truncate text-base font-bold text-slate-900">
            ใบรับเอกสาร — {item.title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className={`rounded-full px-2.5 py-0.5 font-medium ${status.badge}`}>{status.label}</span>
            {docNo && <span>เลขที่ {docNo}</span>}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่าง"
          className="rounded-md px-2 py-1 text-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          ✕
        </button>
      </header>

      {/* เนื้อหา (เลื่อนดูได้) */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        {item.status === 'rejected' && (
          <div className="mx-auto mb-4 max-w-3xl rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="text-xs font-semibold text-red-600">เหตุผลที่ไม่อนุมัติ</p>
            <p className="mt-1">{item.rejectReason || 'ไม่มีการระบุเหตุผล'}</p>
          </div>
        )}

        {receipt ? (
          <div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
            <ReceiptDocument receipt={receipt} />
          </div>
        ) : (
          /* รายการที่ไม่มีสำเนาใบรับเอกสาร (ส่งก่อนมีระบบเก็บสำเนา หรือเป็นข้อมูลตัวอย่าง) */
          <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            <p className="font-semibold">ไม่มีสำเนาใบรับเอกสารของรายการนี้</p>
            <p className="mt-1">
              รายการนี้ถูกส่งก่อนที่ระบบจะเก็บสำเนาใบรับเอกสาร หรือเป็นข้อมูลตัวอย่าง
              ให้ผู้ส่งส่งเอกสารใหม่อีกครั้งเพื่อให้มีใบรับเอกสารสำหรับตรวจสอบ
            </p>

            <dl className="mt-4 space-y-1 text-xs text-amber-900">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-amber-700">รายการ</dt>
                <dd className="font-medium">{item.title}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-amber-700">ประเภท</dt>
                <dd className="font-medium">{item.docType || 'เอกสารทั่วไป'}</dd>
              </div>
            </dl>

            {item.files && item.files.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-amber-200 pt-3 text-xs">
                {item.files.map((f) => (
                  <li key={f.name} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{f.name}</span>
                    <span className="shrink-0 text-amber-700">{formatSize(f.size)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* แถบปุ่มด้านล่าง */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-orange-100 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setPrinting(true)}
          disabled={!receipt}
          className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm text-brand-600 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
          </svg>
          ดาวน์โหลด (PDF)
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ปิด
          </button>

          {onReject && (
            <button
              type="button"
              onClick={onReject}
              className="rounded-lg border border-brand bg-white px-5 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
            >
              Reject
            </button>
          )}

          {onApprove && (
            <button
              type="button"
              onClick={onApprove}
              className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
            >
              Approve
            </button>
          )}
        </div>
      </footer>

      {/* สำเนาที่ใช้พิมพ์จริง (ซ่อนบนหน้าจอ แสดงเฉพาะตอนพิมพ์) */}
      {printing && receipt && (
        <PrintPortal>
          <ReceiptDocument receipt={receipt} />
        </PrintPortal>
      )}
    </div>
  )
}