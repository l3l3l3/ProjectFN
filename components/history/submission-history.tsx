'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useApprovals } from '@/lib/approvals-store'
import type { ApprovalItem, Status } from '@/lib/approvals-store'
import { useSession } from '@/lib/use-session'
import { allowedCompanies, matchesCompany } from '@/lib/company-access'


const STATUS_META: Record<Status, { label: string; badge: string }> = {
  pending: { label: 'รอดำเนินการ', badge: 'bg-amber-100 text-amber-700' },
  approved: { label: 'อนุมัติแล้ว', badge: 'bg-green-100 text-green-700' },
  rejected: { label: 'ไม่อนุมัติ', badge: 'bg-red-100 text-red-700' },
}

const FILTERS: { key: 'all' | Status; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'pending', label: 'รอดำเนินการ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ไม่อนุมัติ' },
]

/* ---------- ดึงบริษัท / symbol จากรายการ (รายการเก่าที่ไม่มีฟิลด์ จะแกะจากชื่อ "SYMBOL — ผู้ออก") ---------- */
const parts = (item: ApprovalItem) => item.title.split(/\s+[—–-]\s+/)
const symbolOf = (item: ApprovalItem) => item.symbol || (parts(item).length > 1 ? parts(item)[0] : '')
const companyOf = (item: ApprovalItem) => item.issuer || (parts(item).length > 1 ? parts(item)[1] : '')

// เอกสารที่ผู้ใช้ส่งเอง (ในข้อมูลเดิมผู้ส่งเก็บเป็น "ฉัน")
const isMine = (item: ApprovalItem) => item.submitter === 'ฉัน'

// ลิงก์ไปหน้าเปรียบเทียบเวอร์ชัน แยกตามฝั่งผู้ใช้ (route group ใน () ไม่นับเป็น URL)
//   agent   → หน้าติดตามสถานะอยู่ที่ /tracking → /tracking/versions/[id]
//   officer → app/(app)/(officer)/approvals/versions/[id]/page.tsx → /approvals/versions/[id]
const COMPARE_BASE = {
  agent: '/tracking/versions',
  officer: '/approvals/versions',
} as const
const compareHref = (mode: 'agent' | 'officer', id: number | string) =>
  `${COMPARE_BASE[mode]}/${encodeURIComponent(String(id))}`

const formatSize = (bytes: number) => {
  if (!bytes) return 'ไม่ระบุขนาด'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// "ประเภทเอกสาร" ในตาราง = เทมเพลตที่เลือกตอนส่ง (เช่น Template A / Template B) ไม่ใช่ชื่อไฟล์แนบ
const templateOf = (item: ApprovalItem) => item.receipt?.templateName || item.docType || 'เอกสารทั่วไป'

/* ---------- แบบข้อมูลตราสารหนี้ (PDF) ----------
   รายการอนุมัติเก็บแค่ชื่อ/ประเภทไฟล์ในแต่ละเวอร์ชัน ส่วนตัวไฟล์ PDF อยู่ในคลังเอกสาร (/api/documents)
   จึงต้องจับคู่: ไฟล์ในเวอร์ชัน → เอกสารในคลัง → เวอร์ชันของไฟล์ (ตรรกะเดียวกับหน้าเปรียบเทียบเวอร์ชัน) */
type ApprovalFile = { name: string; size: number; documentId?: string; version?: string; documentType?: string }
type VersionEntry = { version: string; submittedAt: string; files?: ApprovalFile[] }
type StoredVersion = { version: string; fileName: string }
type StoredDocument = {
  id: string
  issuer?: string
  symbol?: string
  documentType?: string
  title: string
  versions: StoredVersion[]
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '')
const versionNumber = (value?: string) => Number(value?.match(/\d+/)?.[0] || 0)

const BOND_SHEET_NAMES = ['แบบข้อมูลตราสารหนี้', 'สำเนาข้อมูลตราสารหนี้']
const isBondSheetLabel = (label: string) => {
  const text = label.toLowerCase()
  return BOND_SHEET_NAMES.some((name) => text.includes(name)) || normalize(text).includes('bonddatasheet')
}

// ทุกเวอร์ชันของรายการ เรียงจากเก่าไปใหม่ (รายการเก่าที่ไม่มี versionHistory ใช้เวอร์ชันปัจจุบันอย่างเดียว)
const versionsOf = (item: ApprovalItem): VersionEntry[] => {
  const raw = item as unknown as {
    versionHistory?: VersionEntry[]
    files?: ApprovalFile[]
    version: string
    submittedAt: string
  }
  if (raw.versionHistory?.length) {
    return [...raw.versionHistory].sort((a, b) => versionNumber(a.version) - versionNumber(b.version))
  }
  return [{ version: raw.version, submittedAt: raw.submittedAt, files: raw.files ?? [] }]
}

const bondSheetOf = (entry?: VersionEntry) =>
  entry?.files?.find((f) => isBondSheetLabel(`${f.documentType || ''} ${f.name || ''}`))

const findBondSheetDocument = (
  file: ApprovalFile | undefined,
  item: ApprovalItem,
  docs: StoredDocument[],
): StoredDocument | undefined => {
  const isBondDoc = (d: StoredDocument) => isBondSheetLabel(`${d.documentType || ''} ${d.title || ''}`)
  const issuer = normalize(companyOf(item))
  const symbol = normalize(symbolOf(item))
  const fileType = normalize(file?.documentType || '')
  const fileName = normalize(file?.name || '')

  const best = docs
    .map((d) => {
      let score = 0
      const type = normalize(d.documentType || '')
      const title = normalize(d.title || '')
      if (file?.documentId && d.id === file.documentId) score += 1000
      if (fileType && type === fileType) score += 120
      if (fileType && title.includes(fileType)) score += 80
      if (fileName && d.versions?.some((v) => normalize(v.fileName) === fileName)) score += 100
      if (issuer && normalize(d.issuer || '') === issuer) score += 30
      if (symbol && normalize(d.symbol || '') === symbol) score += 30
      if (isBondDoc(d)) score += 10
      return { d, score }
    })
    .sort((a, b) => b.score - a.score)[0]
  if (best && best.score > 0 && isBondDoc(best.d)) return best.d

  // หาจากบริษัท / symbol เมื่อไม่พบไฟล์ที่ตรงกันโดยตรง (ต้องเหลือรายการเดียวเท่านั้น)
  const candidates = docs.filter(
    (d) =>
      isBondDoc(d) &&
      (!issuer || normalize(d.issuer || '') === issuer) &&
      (!symbol || normalize(d.symbol || '') === symbol),
  )
  return candidates.length === 1 ? candidates[0] : undefined
}

const resolveStoredVersion = (
  doc: StoredDocument | undefined,
  file: ApprovalFile | undefined,
  entry: VersionEntry,
  versions: VersionEntry[],
) => {
  if (!doc?.versions?.length) return undefined
  if (file?.version) {
    const exact = doc.versions.find((v) => v.version === file.version)
    if (exact) return exact
  }
  if (file?.name) {
    const sameName = doc.versions.find((v) => normalize(v.fileName) === normalize(file.name))
    if (sameName) return sameName
  }
  const historyIndex = versions.findIndex((h) => h.version === entry.version)
  if (historyIndex >= 0 && doc.versions.length >= versions.length) {
    const mapped = doc.versions[doc.versions.length - versions.length + historyIndex]
    if (mapped) return mapped
  }
  const n = versionNumber(entry.version)
  return n ? doc.versions.find((v) => versionNumber(v.version) === n) : undefined
}

// URL ของ PDF แบบข้อมูลตราสารหนี้ในเวอร์ชันที่ระบุ (ไม่พบ = null)
const bondSheetUrl = (
  item: ApprovalItem,
  entry: VersionEntry,
  versions: VersionEntry[],
  docs: StoredDocument[],
): string | null => {
  const file = bondSheetOf(entry)
  const doc = findBondSheetDocument(file, item, docs)
  const stored = resolveStoredVersion(doc, file, entry, versions)
  if (!doc || !stored) return null
  return `/api/documents?id=${encodeURIComponent(doc.id)}&version=${encodeURIComponent(stored.version)}`
}

type PreviewTarget = { title: string; url: string }

function PdfPreviewDialog({ preview, onClose }: { preview: PreviewTarget; onClose: () => void }) {
  useEffect(() => {
    // ดักตอน capture เพื่อให้ Esc ปิดเฉพาะป็อบอัพ PDF ไม่ปิดหน้าต่างรายละเอียดข้างล่างไปด้วย
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`ตัวอย่าง PDF ${preview.title}`}
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] max-h-[760px] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-800">{preview.title}</p>
            <p className="text-[11px] text-slate-400">ตัวอย่างเอกสาร PDF</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50"
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
  )
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[status].badge}`}>
      {STATUS_META[status].label}
    </span>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

/* ---------- หน้าต่างดูสถานะของแต่ละรายการ ---------- */
function DetailDialog({
  item,
  mode,
  storedDocs,
  docsLoading,
  onPreview,
  onClose,
}: {
  item: ApprovalItem
  mode: 'agent' | 'officer'
  storedDocs: StoredDocument[]
  docsLoading: boolean
  onPreview: (preview: PreviewTarget) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const versions = item.versionHistory?.length
    ? item.versionHistory
    : [{ version: item.version, submittedAt: item.submittedAt, files: item.files ?? [] }]

  const sheetVersions = versionsOf(item)
  const latestEntry = sheetVersions[sheetVersions.length - 1]
  const sheetUrl = bondSheetUrl(item, latestEntry, sheetVersions, storedDocs)
  const sheetFileName = bondSheetOf(latestEntry)?.name
  // ไฟล์แนบแบบเดิม (ตัดแบบข้อมูลตราสารหนี้ออก เพราะแสดงเป็นแถวแรกแล้ว)
  const attachedFiles = (item.files ?? []).filter(
    (f) => !isBondSheetLabel(`${f.documentType || ''} ${f.name || ''}`),
  )

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`สถานะเอกสาร ${item.title}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
            <p className="mt-1 text-xs text-slate-400">รหัสรายการ #{item.id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={item.status} />
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิด"
              className="text-xl leading-none text-slate-400 hover:text-slate-700"
            >
              ×
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <Info label="บริษัท" value={companyOf(item)} />
          <Info label="Symbol" value={symbolOf(item)} />
          <Info label="ผู้ส่งเอกสาร" value={item.submitter} />
          <Info label="วันที่ส่งล่าสุด" value={item.submittedAt} />
          <Info label="เวอร์ชันล่าสุด" value={item.version} />
          <Info label="ผู้ตรวจสอบ" value={item.reviewer} />
          <Info label="เทมเพลต" value={templateOf(item) === 'เอกสารทั่วไป' ? '' : templateOf(item)} />
          <Info label="เลขที่ใบรับเอกสาร" value={item.receipt?.docNo || ''} />
        </div>

        {item.status === 'rejected' && (
          <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-600">เหตุผลที่ไม่อนุมัติ</p>
            <p className="mt-1 text-sm text-red-700">{item.rejectReason || 'ไม่มีการระบุเหตุผล'}</p>
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900">ลำดับสถานะ</h3>
          <ol className="mt-3 space-y-3 border-l-2 border-orange-100 pl-4">
            {versions.map((v) => (
              <li key={v.version} className="relative">
                <span className="absolute -left-[22px] top-1.5 size-2.5 rounded-full bg-brand" />
                <p className="text-sm font-medium text-slate-800">ส่งเอกสารเวอร์ชัน {v.version}</p>
                <p className="text-xs text-slate-500">วันที่ส่ง {v.submittedAt}</p>
                
              </li>
            ))}
            <li className="relative">
              <span
                className={`absolute -left-[22px] top-1.5 size-2.5 rounded-full ${
                  item.status === 'approved'
                    ? 'bg-green-500'
                    : item.status === 'rejected'
                      ? 'bg-red-500'
                      : 'bg-amber-400'
                }`}
              />
              <p className="text-sm font-medium text-slate-800">
                สถานะปัจจุบัน: {STATUS_META[item.status].label}
              </p>
              <p className="text-xs text-slate-400">
                ระบบเดิมยังไม่เก็บวัน-เวลาและชื่อผู้ตัดสิน จึงแสดงได้เฉพาะสถานะล่าสุด
              </p>
            </li>
          </ol>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900">เอกสารที่ส่ง (เวอร์ชันล่าสุด)</h3>
          <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">แบบข้อมูลตราสารหนี้</p>
                <p className="text-xs text-slate-400">
                  {sheetFileName ? `${sheetFileName} · ` : ''}
                  {latestEntry.version}
                </p>
              </div>
              {sheetUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    onPreview({ title: `แบบข้อมูลตราสารหนี้ ${latestEntry.version} · ${item.title}`, url: sheetUrl })
                  }
                  className="shrink-0 rounded-md border border-orange-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                >
                  เปิด PDF
                </button>
              ) : (
                <span className="shrink-0 text-xs text-slate-400">
                  {docsLoading ? 'กำลังโหลด…' : 'ไม่พบไฟล์ PDF'}
                </span>
              )}
            </div>

            {attachedFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{f.documentType || f.name}</p>
                  <p className="text-xs text-slate-400">
                    {f.name} · {formatSize(f.size)} · {f.version || 'ไม่ระบุเวอร์ชัน'}
                  </p>
                </div>
                {f.documentId && f.version && (
                  <a
                    href={`/api/documents?id=${encodeURIComponent(f.documentId)}&version=${encodeURIComponent(f.version)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-md border border-orange-200 px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                  >
                    เปิด PDF
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          {sheetVersions.length > 1 ? (
            <Link
              href={compareHref(mode, item.id)}
              className="rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              เปรียบเทียบเวอร์ชัน
            </Link>
          ) : (
            <span
              title="มีเวอร์ชันเดียว ยังไม่มีอะไรให้เปรียบเทียบ"
              aria-disabled="true"
              className="cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-300"
            >
              เปรียบเทียบเวอร์ชัน
            </span>
          )}
          {mode === 'officer' && item.status === 'pending' && (
            <Link
              href="/approvals"
              className="rounded-md border border-orange-300 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50"
            >
              ไปหน้าตรวจ / อนุมัติ
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- หน้าประวัติการส่งเอกสาร ----------
   mode="agent"   : บริษัท / ตัวแทน / อันเดอร์ไรเตอร์ เห็นเฉพาะบริษัทที่มีสิทธิ์
   mode="officer" : เจ้าหน้าที่ตรวจสอบ เห็นทุกบริษัทและทุกคำขอ */
export function SubmissionHistory({ mode }: { mode: 'agent' | 'officer' }) {
  const session = useSession()
  const approvals = useApprovals()

  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)
  const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)

  // โหลดรายการ PDF ในคลังเอกสาร ใช้หา "แบบข้อมูลตราสารหนี้" ของแต่ละรายการ
  useEffect(() => {
    let active = true
    fetch('/api/documents', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('โหลดคลังเอกสารไม่สำเร็จ')
        return res.json()
      })
      .then((result) => {
        if (active && Array.isArray(result.documents)) setStoredDocs(result.documents)
      })
      .catch((error) => console.error('Load document index error:', error))
      .finally(() => {
        if (active) setDocsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const scope = useMemo(() => (session ? allowedCompanies(session) : []), [session])
  // บัญชีบริษัท (aaa/bbb/ccc) ไม่ต้องเห็นคอลัมน์ "บริษัท" — เฉพาะตัวแทนบริษัทและเจ้าหน้าที่ที่ยังเห็น
  const hideCompanyCol = mode === 'agent' && session?.label !== 'ตัวแทนบริษัท'

  // เอกสารที่ผู้ใช้นี้มีสิทธิ์เห็น
  const scoped = useMemo(
    () =>
      scope === 'all'
        ? approvals
        : approvals.filter((i) => isMine(i) || matchesCompany(companyOf(i), scope)),
    [approvals, scope],
  )

  const companies = useMemo(
    () => Array.from(new Set(scoped.map((i) => companyOf(i)).filter(Boolean))).sort(),
    [scoped],
  )

  const counts = useMemo(
    () => ({
      all: scoped.length,
      pending: scoped.filter((i) => i.status === 'pending').length,
      approved: scoped.filter((i) => i.status === 'approved').length,
      rejected: scoped.filter((i) => i.status === 'rejected').length,
    }),
    [scoped],
  )

  const visible = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return scoped.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (companyFilter !== 'all' && companyOf(i) !== companyFilter) return false
      if (!kw) return true
      return [i.title, companyOf(i), symbolOf(i), i.submitter].some((v) => v.toLowerCase().includes(kw))
    })
  }, [scoped, statusFilter, companyFilter, keyword])

  const selected = selectedId === null ? null : (scoped.find((i) => i.id === selectedId) ?? null)

  return (
    <div className="space-y-5 p-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">ประวัติการส่งเอกสาร</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mode === 'officer'
            ? 'คำขอส่งเอกสารของทุกบริษัท พร้อมสถานะ กดดูรายละเอียดเพื่อดูสถานะของแต่ละรายการ'
            : 'ประวัติเอกสารที่ส่งในนามบริษัทที่คุณมีสิทธิ์ กดดูรายละเอียดเพื่อดูสถานะของแต่ละรายการ'}
        </p>
      </div>

      {/* ขอบเขตสิทธิ์ */}
      <div className="rounded-lg border border-orange-100 bg-white p-4">
        {scope === 'all' ? (
          <p className="text-sm text-slate-700">
            <b>ขอบเขตการมองเห็น:</b> ทุกบริษัทและทุกคำขอส่งเอกสาร ({counts.all} รายการ)
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm text-slate-700">บริษัทที่คุณมีสิทธิ์:</b>
            {scope.length === 0 ? (
              <span className="text-sm text-slate-400">ยังไม่ได้รับสิทธิ์ส่งแทนบริษัทใด</span>
            ) : (
              scope.map((c) => (
                <span key={c} className="rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-xs text-brand-600">
                  {c}
                </span>
              ))
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-slate-400">
          ทั้งหมด {counts.all} · รอดำเนินการ {counts.pending} · อนุมัติแล้ว {counts.approved} · ไม่อนุมัติ{' '}
          {counts.rejected}
        </p>
      </div>

      {/* ตัวกรอง */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                statusFilter === key
                  ? 'border-brand bg-brand text-white'
                  : 'border-orange-200 bg-white text-brand-600 hover:bg-brand-50'
              }`}
            >
              {label} {counts[key]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {companies.length > 1 && (
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              aria-label="กรองตามบริษัท"
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="all">ทุกบริษัท</option>
              {companies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="ค้นหาบริษัท / Symbol / ผู้ส่ง"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-orange-100 sm:w-64"
          />
        </div>
      </div>

      {/* ตาราง */}
      <div className="overflow-x-auto rounded-lg border border-orange-100 bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-brand-50 text-xs font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">วันที่ส่ง</th>
              {!hideCompanyCol && <th className="px-4 py-3">บริษัท</th>}
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">ประเภทเอกสาร</th>
              <th className="px-4 py-3">ผู้ส่ง</th>
              <th className="px-4 py-3">ผู้ตรวจ</th>
              <th className="px-4 py-3">เวอร์ชัน</th>
              <th className="px-4 py-3">สถานะ</th>
              <th className="px-4 py-3 text-center">รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={hideCompanyCol ? 8 : 9} className="px-4 py-12 text-center text-slate-400">
                  {scoped.length === 0 ? 'ยังไม่มีเอกสารที่คุณมีสิทธิ์เห็น' : 'ไม่พบรายการที่ตรงกับเงื่อนไข'}
                </td>
              </tr>
            ) : (
              visible.map((item) => {
                const itemVersions = versionsOf(item)
                const latest = itemVersions[itemVersions.length - 1]
                const sheetUrl = bondSheetUrl(item, latest, itemVersions, storedDocs)
                return (
                  <tr key={item.id} className="border-t border-orange-100 hover:bg-brand-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{item.submittedAt}</td>
                    {!hideCompanyCol && (
                      <td className="px-4 py-3 font-medium text-slate-900">{companyOf(item) || '— ไม่ระบุ —'}</td>
                    )}
                    <td className="px-4 py-3 text-slate-700">{symbolOf(item) || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{templateOf(item)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.submitter}</td>
                    <td className="px-4 py-3 text-slate-700">{item.reviewer}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{item.version}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={item.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className="rounded-md border border-orange-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50"
                        >
                          ดูสถานะ
                        </button>
                        
                        {itemVersions.length > 1 ? (
                          <Link
                            href={compareHref(mode, item.id)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            เปรียบเทียบ
                          </Link>
                        ) : (
                          <span
                            title="มีเวอร์ชันเดียว ยังไม่มีอะไรให้เปรียบเทียบ"
                            aria-disabled="true"
                            className="cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-300"
                          >
                            เปรียบเทียบ
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-right text-xs text-slate-400">
        แสดง {visible.length} จาก {scoped.length} รายการ
      </div>

      {selected && (
        <DetailDialog
          item={selected}
          mode={mode}
          storedDocs={storedDocs}
          docsLoading={docsLoading}
          onPreview={setPreview}
          onClose={() => setSelectedId(null)}
        />
      )}

      {preview && <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

/* ---------- หน้าต่างรายละเอียด/ดูสถานะ ใช้ซ้ำในหน้าอื่น (เช่น หน้าตรวจสอบและอนุมัติ) ----------
   โหลดคลังเอกสารเอง จึงใส่แค่ item + mode แล้วเปิดได้เลย */
export function ItemDetailModal({
  item,
  mode,
  onClose,
}: {
  item: ApprovalItem
  mode: 'agent' | 'officer'
  onClose: () => void
}) {
  const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewTarget | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/documents', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('โหลดคลังเอกสารไม่สำเร็จ')
        return res.json()
      })
      .then((result) => {
        if (active && Array.isArray(result.documents)) setStoredDocs(result.documents)
      })
      .catch((error) => console.error('Load document index error:', error))
      .finally(() => {
        if (active) setDocsLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <DetailDialog
        item={item}
        mode={mode}
        storedDocs={storedDocs}
        docsLoading={docsLoading}
        onPreview={setPreview}
        onClose={onClose}
      />
      {preview && <PdfPreviewDialog preview={preview} onClose={() => setPreview(null)} />}
    </>
  )
}