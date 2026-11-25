import { useSyncExternalStore } from 'react'
import type { BondData } from '@/app/(app)/(company)/bonds/submit/bond-config'

/* ---------- ชนิดข้อมูล ---------- */
export type Status = 'pending' | 'approved' | 'rejected'

// สำเนาใบรับเอกสาร เก็บไว้กับรายการ เพื่อให้ผู้ตรวจกดดูในหน้า Approvals ได้
// issuedAt เก็บเป็นข้อความ ISO เพราะ localStorage เก็บ Date ตรง ๆ ไม่ได้
export type StoredReceipt = {
  docNo: string
  issuedAt: string
  templateName: string
  submitter: string
  data: BondData
  attachments: { label: string; name: string; size: number }[]
}

export type ApprovalFile = {
  name: string
  size: number
  documentId?: string
  version?: string
  documentType?: string
}

export type ApprovalVersion = {
  version: string
  submittedAt: string
  docType?: string
  detail?: string
  files: ApprovalFile[]
  bondData?: unknown
}

export type ApprovalItem = {
  id: number
  title: string
  submitter: string
  reviewer: string
  submittedAt: string
  version: string
  status: Status
  rejectReason?: string

  docType?: string
  detail?: string
  dueDate?: string
  issuer?: string
  symbol?: string
  bondData?: unknown
  files?: ApprovalFile[]
  versionHistory?: ApprovalVersion[]
  receipt?: StoredReceipt // สำเนาใบรับเอกสาร (มีเฉพาะรายการที่ส่งจากหน้าส่งตรวจเอกสาร)
}

/* ---------- ข้อมูลตัวอย่างเริ่มต้น ---------- */
const SUBMITTERS = ['สมชาย ก.', 'วิภา ส.', 'ธนา ป.', 'นภา ร.']
const REVIEWERS = ['ผู้ตรวจ A', 'ผู้ตรวจ B', 'ผู้ตรวจ C']
const TITLES = [
  'Investment Memo',
  'Risk Report',
  'Audit Summary',
  'Loan Agreement',
  'Compliance Checklist',
  'Cash Flow Forecast',
]

// 4 รายการที่รออนุมัติ ตามรูปตัวอย่าง
const PENDING_SEED: ApprovalItem[] = [
  { id: 1, title: 'Pitch Deck Q4', submitter: 'สมชาย ก.', reviewer: 'ผู้ตรวจ A', submittedAt: '12 ต.ค.', version: 'v1.3', status: 'pending' },
  { id: 2, title: 'Financial Model', submitter: 'วิภา ส.', reviewer: 'ผู้ตรวจ B', submittedAt: '11 ต.ค.', version: 'v2.0', status: 'pending' },
  { id: 3, title: 'Term Sheet', submitter: 'ธนา ป.', reviewer: 'ผู้ตรวจ A', submittedAt: '9 ต.ค.', version: 'v1.0', status: 'pending' },
  { id: 4, title: 'Business Plan', submitter: 'นภา ร.', reviewer: 'ผู้ตรวจ C', submittedAt: '8 ต.ค.', version: 'v1.1', status: 'pending' },
]

// สร้างรายการตัวอย่างสำหรับแท็บ "อนุมัติแล้ว" / "ไม่อนุมัติ"
// (ไม่ใช้ค่าสุ่ม เพื่อไม่ให้ render ฝั่งเซิร์ฟเวอร์กับเบราว์เซอร์ไม่ตรงกัน)
const makeSeed = (startId: number, count: number, status: Status): ApprovalItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    title: `${TITLES[i % TITLES.length]} ${Math.floor(i / TITLES.length) + 1}`,
    submitter: SUBMITTERS[i % SUBMITTERS.length],
    reviewer: REVIEWERS[i % REVIEWERS.length],
    submittedAt: `${(i % 28) + 1} ก.ย.`,
    version: `v1.${i % 4}`,
    status,
    rejectReason: status === 'rejected' ? 'ข้อมูลไม่ครบถ้วน' : undefined,
  }))

export const INITIAL_ITEMS: ApprovalItem[] = [
  ...PENDING_SEED,
  ...makeSeed(5, 18, 'approved'), // อนุมัติแล้ว 18
  ...makeSeed(23, 3, 'rejected'), // ไม่อนุมัติ 3
]

/* ---------- store ที่ใช้ร่วมกันหลายหน้า ---------- */
// เก็บใน localStorage เพื่อให้
//   1) ส่งจากหน้า "ส่งตรวจเอกสาร" แล้วไปโผล่ในหน้า Approvals ได้
//   2) รีเฟรชหน้าแล้วข้อมูลไม่หาย
//   3) เปิดหลายแท็บแล้วข้อมูลตรงกัน
const STORAGE_KEY = 'approval-items'
const listeners = new Set<() => void>()
let cache: ApprovalItem[] | null = null // snapshot ต้องเป็นก้อนเดิมจนกว่าข้อมูลจะเปลี่ยนจริง

const load = (): ApprovalItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ApprovalItem[]
  } catch {
    // อ่านไม่ได้ (เช่น ข้อมูลเสีย) ให้ใช้ค่าเริ่มต้น
  }
  return INITIAL_ITEMS
}

const getSnapshot = (): ApprovalItem[] => {
  if (cache === null) cache = load()
  return cache
}

// ฝั่งเซิร์ฟเวอร์ไม่มี localStorage ให้ใช้ค่าเริ่มต้น (ตรงกับที่เบราว์เซอร์ render รอบแรก)
const getServerSnapshot = (): ApprovalItem[] => INITIAL_ITEMS

const subscribe = (callback: () => void) => {
  listeners.add(callback)

  // เมื่อแท็บอื่นแก้ข้อมูล ให้โหลดใหม่
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null
      callback()
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    listeners.delete(callback)
    window.removeEventListener('storage', onStorage)
  }
}

const save = (next: ApprovalItem[]) => {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // เก็บไม่ได้ (เช่น พื้นที่เต็ม) ยังใช้งานต่อได้ในหน้านี้ แต่จะไม่คงอยู่หลังรีเฟรช
  }
  listeners.forEach((l) => l())
}

/* ---------- ฟังก์ชันที่หน้าต่าง ๆ เรียกใช้ ---------- */

// อ่านรายการทั้งหมด (หน้าจะ render ใหม่เองเมื่อข้อมูลเปลี่ยน)
export const useApprovals = (): ApprovalItem[] =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

// แก้รายการ เขียนแบบเดียวกับ setState: updateApprovals((prev) => prev.map(...))
export const updateApprovals = (updater: (prev: ApprovalItem[]) => ApprovalItem[]) => {
  save(updater(getSnapshot()))
}

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

// ข้อมูลที่หน้า "ส่งตรวจเอกสาร" ส่งมา
export type NewApproval = {
  title: string
  issuer: string
  symbol: string
  bondData: unknown
  docType?: string
  detail?: string
  dueDate?: string
  files: ApprovalFile[]
}

// ส่งเอกสารเดิมซ้ำจะอัปเดตรายการเดิมและเพิ่ม Version
// เอกสารใหม่จะสร้างรายการใหม่เป็น v1.0
export const addApproval = (input: NewApproval): number => {
  const now = new Date()
  const submittedAt = `${now.getDate()} ${THAI_MONTHS[now.getMonth()]}`
  const normalize = (value: string) => value.trim().toLocaleLowerCase()
  const issuerKey = normalize(input.issuer)
  const symbolKey = normalize(input.symbol)
  let approvalId = 0

  updateApprovals((prev) => {
    // ใช้ issuer + symbol เป็นตัวตนหลัก
    // title fallback ช่วยเชื่อมรายการเก่าที่สร้างก่อนเพิ่ม issuer/symbol
    const existingIndex = prev.findIndex((item) => {
      if (item.issuer && item.symbol) {
        return normalize(item.issuer) === issuerKey &&
          normalize(item.symbol) === symbolKey
      }
      return item.title.trim() === input.title.trim()
    })

    if (existingIndex >= 0) {
      const existing = prev[existingIndex]
      approvalId = existing.id
      const oldHistory = existing.versionHistory?.length
        ? existing.versionHistory
        : [{
            version: existing.version || 'v1.0',
            submittedAt: existing.submittedAt,
            docType: existing.docType,
            detail: existing.detail,
            files: existing.files || [],
            bondData: existing.bondData,
          }]

      // หาเลขเวอร์ชันสูงสุดจากทั้งค่าปัจจุบันและประวัติ
      // เพื่อไม่ให้ส่งเอกสารซ้ำแล้วได้ v2.0 ซ้ำทุกครั้ง
      const knownVersions = [existing.version, ...oldHistory.map((item) => item.version)]
      const currentMajor = knownVersions.reduce((highest, version) => {
        const match = version?.match(/^v(\d+)(?:\.\d+)?$/i)
        const major = match ? Number(match[1]) : 0
        return Number.isFinite(major) ? Math.max(highest, major) : highest
      }, 1)
      const nextVersion = `v${currentMajor + 1}.0`

      const updated: ApprovalItem = {
        ...existing,
        title: input.title,
        issuer: input.issuer,
        symbol: input.symbol,
        bondData: input.bondData,
        submitter: 'ฉัน',
        submittedAt,
        version: nextVersion,
        status: 'pending',
        rejectReason: undefined,
        docType: input.docType,
        detail: input.detail,
        dueDate: input.dueDate,
        files: input.files,
        versionHistory: [
          ...oldHistory,
          {
            version: nextVersion,
            submittedAt,
            docType: input.docType,
            detail: input.detail,
            files: input.files,
            bondData: input.bondData,
          },
        ],
      }

      const next = [...prev]
      next.splice(existingIndex, 1)
      return [updated, ...next]
    }

    approvalId = prev.length > 0 ? Math.max(...prev.map((item) => item.id)) + 1 : 1
    const item: ApprovalItem = {
      id: approvalId,
      title: input.title,
      issuer: input.issuer,
      symbol: input.symbol,
      bondData: input.bondData,
      submitter: 'ฉัน',
      reviewer: 'ยังไม่ระบุ',
      submittedAt,
      version: 'v1.0',
      status: 'pending',
      docType: input.docType,
      detail: input.detail,
      dueDate: input.dueDate,
      files: input.files,
      versionHistory: [{
        version: 'v1.0',
        submittedAt,
        docType: input.docType,
        detail: input.detail,
        files: input.files,
        bondData: input.bondData,
      }],
    }
    return [item, ...prev]
  })

  return approvalId
}

// แนบสำเนาใบรับเอกสารให้รายการ (เรียกหลัง addApproval เพราะเลขที่เอกสารสร้างจาก id ที่ addApproval คืนมา)
// ส่งซ้ำเอกสารเดิม จะเขียนทับด้วยใบรับเอกสารของเวอร์ชันล่าสุด
export const attachReceipt = (id: number, receipt: StoredReceipt) => {
  updateApprovals((prev) =>
    prev.map((i) => (i.id === id ? { ...i, receipt } : i))
  )
}