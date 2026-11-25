export type LogStatus = 'submitted' | 'approved' | 'rejected'

export interface AuditLog {
  id: string
  datetime: string // 'YYYY-MM-DD HH:mm'
  docNo: string
  docName: string
  docType: string
  issuer: string
  submittedBy: string
  status: LogStatus
  reviewer: string | null
  remark: string | null
}

const KEY = 'audit-logs'
export const AUDIT_LOG_EVENT = 'audit-logs-changed'

const pad = (n: number) => String(n).padStart(2, '0')

const nowText = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function getAuditLogs(): AuditLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as AuditLog[]) : []
  } catch {
    return []
  }
}

// บันทึกเหตุการณ์ 1 รายการ (ใหม่สุดอยู่บนสุด)
export function addAuditLog(entry: Omit<AuditLog, 'id' | 'datetime'>) {
  if (typeof window === 'undefined') return
  const log: AuditLog = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    datetime: nowText(),
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify([log, ...getAuditLogs()]))
    window.dispatchEvent(new Event(AUDIT_LOG_EVENT))
  } catch (e) {
    console.error('บันทึก Audit Log ไม่สำเร็จ', e)
  }
}
