'use client'

import { useMemo, useState } from 'react'
import { updateApprovals, useApprovals } from '@/lib/approvals-store'
import type { ApprovalItem, Status } from '@/lib/approvals-store'
import { ItemDetailModal } from '@/components/history/submission-history'
import { VersionCompare } from '@/components/history/version-compare'
import { versionsOf } from '@/lib/submission-docs'
import ReceiptViewerDialog from './ReceiptViewerDialog' // ปรับ path ให้ตรงกับที่วางไฟล์จริง

const TABS: { key: Status; label: string }[] = [
  { key: 'pending', label: 'รอตรวจ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
]

/* ---------- สไตล์ปุ่มที่ใช้ซ้ำ ---------- */
const btnDark =
  'rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:border-brand-600 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40'
const btnOutline =
  'rounded-md border border-brand bg-white px-3 py-1.5 text-xs font-medium text-brand-600 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40'

export default function ApprovalsPage() {
  const items = useApprovals()
  const [tab, setTab] = useState<Status>('pending')
  const [keyword, setKeyword] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // เก็บเป็น id แล้วหาจาก items ทุกครั้ง จะได้เป็นข้อมูลล่าสุดเสมอ
  const [viewingId, setViewingId] = useState<number | null>(null)
  // หน้าต่าง "ดูสถานะ" (รายละเอียดรายการ)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [compareId, setCompareId] = useState<number | null>(null)

  const [rejectTarget, setRejectTarget] = useState<ApprovalItem | null>(null)
  const [reason, setReason] = useState('')

  const counts = useMemo(
    () => ({
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    }),
    [items]
  )

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return items.filter(
      (i) =>
        i.status === tab &&
        (kw === '' ||
          i.title.toLowerCase().includes(kw) ||
          i.submitter.toLowerCase().includes(kw))
    )
  }, [items, tab, keyword])

  const isPendingTab = tab === 'pending'
  const viewing =
    viewingId === null ? null : items.find((i) => i.id === viewingId) ?? null
  const detailItem =
    detailId === null ? null : items.find((i) => i.id === detailId) ?? null
  const allSelected = visible.length > 0 && visible.every((i) => selectedIds.includes(i.id))

  /* ----- การกระทำ ----- */
  const changeTab = (next: Status) => {
    setTab(next)
    setSelectedIds([])
    setRejectTarget(null)
    setReason('')
  }

  const toggleOne = (id: number) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : visible.map((i) => i.id))

  const approve = (ids: number[]) => {
    updateApprovals((prev) =>
      prev.map((i) =>
        ids.includes(i.id) && i.status === 'pending'
          ? { ...i, status: 'approved' }
          : i
      )
    )
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    if (rejectTarget && ids.includes(rejectTarget.id)) cancelReject()
  }

  const startReject = (item: ApprovalItem) => {
    setRejectTarget(item)
    setReason('')
  }

  const cancelReject = () => {
    setRejectTarget(null)
    setReason('')
  }

  const confirmReject = () => {
    if (!rejectTarget || reason.trim() === '') return
    const id = rejectTarget.id

    updateApprovals((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: 'rejected', rejectReason: reason.trim() }
          : i
      )
    )

    setSelectedIds((prev) => prev.filter((x) => x !== id))
    cancelReject()
  }

  // ล้างข้อมูลตัวอย่างและรายการซ้ำ
  const handleClearSamples = () => {
    if (!window.confirm('ต้องการลบข้อมูลตัวอย่างและรายการซ้ำใช่หรือไม่?')) return

    updateApprovals((prev) => {
      const seen = new Set<string>()

      return prev.filter((item) => {
        const data = item as ApprovalItem & {
          issuer?: string
          symbol?: string
        }

        const parts = item.title.split(/\s+[—–-]\s+/)
        const issuer = data.issuer || parts[1]
        const symbol = data.symbol || parts[0]

        if (!issuer || !symbol) return false

        const key = `${issuer.trim().toLowerCase()}|${symbol.trim().toLowerCase()}`

        if (seen.has(key)) return false

        seen.add(key)
        return true
      })
    })

    setSelectedIds([])
    setRejectTarget(null)
    setReason('')
  }

  return (
    <div className="space-y-4 p-6">
      {/* หัวข้อ + ปุ่ม */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-slate-900">
          ตรวจสอบและอนุมัติ (Approval Dashboard)
        </h1>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearSamples}
            className="rounded-md border border-red-500 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            ล้างข้อมูลตัวอย่าง
          </button>

          <button
            type="button"
            onClick={() => approve(selectedIds)}
            disabled={selectedIds.length === 0}
            className={`${btnDark} px-4 py-2 text-sm`}
          >
            อนุมัติที่เลือก
            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
          </button>
        </div>
      </div>

      {/* แท็บสถานะ + ช่องค้นหา */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => changeTab(key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                tab === key
                  ? 'border-brand bg-brand text-white'
                  : 'border-orange-200 bg-white text-brand-600 hover:bg-brand-50'
              }`}
            >
              {label} {counts[key]}
            </button>
          ))}
        </div>

        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="ค้นหารายการ"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-orange-100 sm:w-64"
        />
      </div>

      {/* ตาราง */}
      <div className="overflow-x-auto rounded-lg border border-orange-100 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-brand-50 text-xs font-semibold text-slate-700">
            <tr>
              <th className="w-10 px-3 py-3">
                {isPendingTab && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-brand"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="เลือกทั้งหมด"
                  />
                )}
              </th>
              <th className="px-3 py-3">รายการ</th>
              <th className="px-3 py-3">ผู้ส่ง</th>
              <th className="px-3 py-3">ผู้ตรวจ</th>
              <th className="px-3 py-3">วันที่ส่ง</th>
              <th className="px-3 py-3">เวอร์ชัน</th>
              <th className="px-3 py-3">การกระทำ</th>
              <th className="px-3 py-3 text-center">รายละเอียด</th>
            </tr>
          </thead>

          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">
                  ไม่พบรายการ
                </td>
              </tr>
            )}

            {visible.map((item) => (
              <tr
                key={item.id}
                className={`border-t border-orange-100 ${
                  rejectTarget?.id === item.id ? 'bg-brand-50/60' : ''
                }`}
              >
                <td className="px-3 py-3">
                  {isPendingTab && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand"
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`เลือก ${item.title}`}
                    />
                  )}
                </td>

                <td className="px-3 py-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  {(item.docType || item.files?.length) && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {[item.docType, item.files?.length ? `${item.files.length} ไฟล์` : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </td>

                <td className="px-3 py-3 text-slate-700">{item.submitter}</td>
                <td className="px-3 py-3 text-slate-700">{item.reviewer}</td>
                <td className="px-3 py-3 text-slate-700">{item.submittedAt}</td>
                <td className="px-3 py-3 text-slate-700">{item.version}</td>

                <td className="px-3 py-3">
                  {item.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        title="ดูใบรับเอกสาร"
                        aria-label={`ดูใบรับเอกสาร ${item.title}`}
                        onClick={() => setViewingId(item.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-orange-300 bg-white text-brand-600 transition hover:bg-brand-50"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={() => approve([item.id])}
                        className={btnDark}
                      >
                        Approve
                      </button>

                      <button
                        type="button"
                        onClick={() => startReject(item)}
                        className={btnOutline}
                      >
                        Reject
                      </button>
                    </div>
                  )}

                  {item.status === 'approved' && (
                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                      อนุมัติแล้ว
                    </span>
                  )}

                  {item.status === 'rejected' && (
                    <div>
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
                        ไม่อนุมัติ
                      </span>
                      {item.rejectReason && (
                        <p className="mt-1 text-xs text-slate-500">
                          เหตุผล: {item.rejectReason}
                        </p>
                      )}
                    </div>
                  )}
                </td>

                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailId(item.id)}
                      className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                    >
                      ดูสถานะ
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompareId(item.id)}
                      disabled={versionsOf(item).length < 2}
                      title={versionsOf(item).length < 2 ? 'รายการนี้มีเวอร์ชันเดียว' : 'เปรียบเทียบเวอร์ชัน'}
                      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
                    >
                      เปรียบเทียบ
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* กล่องเหตุผลการไม่อนุมัติ */}
      {rejectTarget && (
        <section className="rounded-lg border border-orange-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">
            เหตุผลการไม่อนุมัติ{' '}
            <span className="font-normal text-slate-500">
              — {rejectTarget.title}
            </span>
          </h2>

          <textarea
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ระบุเหตุผลที่ไม่อนุมัติ"
            className="mt-3 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand focus:ring-2 focus:ring-orange-100"
          />

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelReject}
              className={btnOutline}
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={confirmReject}
              disabled={reason.trim() === ''}
              className={btnDark}
            >
              ยืนยัน Reject
            </button>
          </div>
        </section>
      )}

      {/* รายละเอียด / ดูสถานะ ของรายการ */}
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          mode="officer"
          onClose={() => setDetailId(null)}
        />
      )}

      {/* เปรียบเทียบเวอร์ชัน (เปิดเป็นหน้าต่างซ้อน ไม่เปลี่ยนหน้า) */}
      {compareId !== null && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4"
          onClick={() => setCompareId(null)}
        >
          <div
            className="mx-auto max-w-6xl rounded-xl bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <VersionCompare itemId={compareId} mode="officer" onClose={() => setCompareId(null)} />
          </div>
        </div>
      )}

      {/* ใบรับเอกสารของรายการที่กดดู (ผู้ตรวจ Approve / Reject ได้จากในหน้าต่างนี้เลย) */}
      {viewing && (
        <ReceiptViewerDialog
          item={viewing}
          onClose={() => setViewingId(null)}
          onApprove={
            viewing.status === 'pending'
              ? () => {
                  approve([viewing.id])
                  setViewingId(null)
                }
              : undefined
          }
          onReject={
            viewing.status === 'pending'
              ? () => {
                  setViewingId(null)
                  startReject(viewing)
                }
              : undefined
          }
        />
      )}
    </div>
  )
}