'use client'
import React, { useMemo, useState } from 'react'
import { useApprovals } from '@/lib/approvals-store'
import type { ApprovalItem } from '@/lib/approvals-store'

type LogStatus = 'submitted' | 'approved' | 'rejected'

interface AuditLog {
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

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const pad = (n: number) => String(n).padStart(2, '0')

// '21 พ.ย.' -> '2026-11-21 --:--' (ที่เก็บของเพื่อนไม่มีปีและเวลา จึงเดาปีจากวันนี้)
const parseThaiDate = (text: string): string => {
  const m = text.match(/(\d+)\s+(\S+)/)
  const idx = m ? THAI_MONTHS.indexOf(m[2]) : -1
  if (!m || idx < 0) return '-'
  const now = new Date()
  let year = now.getFullYear()
  if (new Date(year, idx, Number(m[1])) > now) year -= 1
  return `${year}-${pad(idx + 1)}-${pad(Number(m[1]))} --:--`
}

const isoToText = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// แปลงรายการของเพื่อน (approval-items) เป็นเหตุการณ์ใน Audit Log
// - ทุกเวอร์ชันที่เคยส่ง = 1 เหตุการณ์ "มีเอกสารส่งมา"
// - ถ้าเวอร์ชันล่าสุดถูกอนุมัติ/ไม่อนุมัติแล้ว = เพิ่มอีก 1 เหตุการณ์
const buildLogs = (items: ApprovalItem[]): AuditLog[] => {
  const out: { log: AuditLog; seq: number }[] = []
  let seq = 0

  // เอาเฉพาะรายการที่ส่งจริง (ข้อมูลตัวอย่างของระบบไม่มี symbol)
  items
    .filter((item) => item.symbol)
    .forEach((item) => {
      const docNo = item.receipt?.docNo ?? `#${item.id}`
      const issuer = item.issuer ?? '-'
      const history = item.versionHistory?.length
        ? item.versionHistory
        : [{ version: item.version, submittedAt: item.submittedAt, docType: item.docType }]

      history.forEach((v, i) => {
        const isLatest = i === history.length - 1
        const when =
          isLatest && item.receipt?.issuedAt ? isoToText(item.receipt.issuedAt) : parseThaiDate(v.submittedAt)
        out.push({
          seq: seq++,
          log: {
            id: `${item.id}-${v.version}-submitted`,
            datetime: when,
            docNo,
            docName: item.title,
            docType: `${v.docType ?? item.docType ?? '-'} · ${v.version}`,
            issuer,
            submittedBy: item.submitter,
            status: 'submitted',
            reviewer: null,
            remark: null,
          },
        })

        if (isLatest && item.status !== 'pending') {
          out.push({
            seq: seq++,
            log: {
              id: `${item.id}-${v.version}-${item.status}`,
              datetime: when, // ที่เก็บของเพื่อนไม่ได้จดเวลาที่ตัดสิน จึงใช้เวลาเดียวกับตอนส่ง
              docNo,
              docName: item.title,
              docType: `${v.docType ?? item.docType ?? '-'} · ${v.version}`,
              issuer,
              submittedBy: item.submitter,
              status: item.status,
              reviewer: item.reviewer,
              remark: item.status === 'rejected' ? item.rejectReason ?? null : null,
            },
          })
        }
      })
    })

  return out
    .sort((a, b) => (a.log.datetime === b.log.datetime ? b.seq - a.seq : a.log.datetime < b.log.datetime ? 1 : -1))
    .map((x) => x.log)
}

// ป้ายสถานะ มีแค่ 3 แบบ
const STATUS_CONFIG: Record<LogStatus, { label: string; badge: string; dot: string }> = {
  submitted: {
    label: 'มีเอกสารส่งมา',
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  approved: {
    label: 'อนุมัติแล้ว',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  rejected: {
    label: 'รีเจค',
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-500',
  },
}

export default function AuditLogPage() {
  const approvals = useApprovals()
  const logs = useMemo(() => buildLogs(approvals), [approvals])

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | LogStatus>('all')
  const [keyword, setKeyword] = useState('')

  // นับจำนวนตามสถานะ (นับจากข้อมูลทั้งหมด)
  const counts = useMemo(
    () => ({
      all: logs.length,
      submitted: logs.filter((l) => l.status === 'submitted').length,
      approved: logs.filter((l) => l.status === 'approved').length,
      rejected: logs.filter((l) => l.status === 'rejected').length,
    }),
    [logs]
  )

  const filteredLogs = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return logs.filter((log) => {
      const day = log.datetime.slice(0, 10) // 'YYYY-MM-DD'
      const matchDate = (!startDate || day >= startDate) && (!endDate || day <= endDate)
      const matchStatus = statusFilter === 'all' || log.status === statusFilter
      const matchKeyword =
        !kw ||
        [log.docNo, log.docName, log.issuer, log.submittedBy].some((v) => v.toLowerCase().includes(kw))
      return matchDate && matchStatus && matchKeyword
    })
  }, [logs, startDate, endDate, statusFilter, keyword])

  const clearFilters = () => {
    setStartDate('')
    setEndDate('')
    setStatusFilter('all')
    setKeyword('')
  }

  const handleExportCSV = () => {
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`
    const headers = 'วันเวลา,เลขที่เอกสาร,ชื่อเอกสาร,ประเภท,ผู้ออกตราสาร,ผู้ส่ง,สถานะ,ผู้ดำเนินการ,หมายเหตุ\n'
    const rows = filteredLogs
      .map((l) =>
        [l.datetime, l.docNo, l.docName, l.docType, l.issuer, l.submittedBy, STATUS_CONFIG[l.status].label, l.reviewer, l.remark]
          .map(esc)
          .join(',')
      )
      .join('\n')
    const blob = new Blob(['\uFEFF' + headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'audit_logs.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const tabs: { key: 'all' | LogStatus; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'submitted', label: STATUS_CONFIG.submitted.label },
    { key: 'approved', label: STATUS_CONFIG.approved.label },
    { key: 'rejected', label: STATUS_CONFIG.rejected.label },
  ]

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto bg-white rounded-lg shadow p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">ประวัติการดำเนินการเอกสาร (Audit Log)</h2>
          <p className="text-sm text-slate-500 mt-1">
            บันทึกเมื่อมีเอกสารตราสารหนี้ถูกส่งเข้าระบบ และเมื่อเอกสารนั้นถูกอนุมัติหรือรีเจค
          </p>
        </div>

        {/* แท็บกรองตามสถานะ พร้อมจำนวน */}
        <div className="flex flex-wrap gap-2 mb-5">
          {tabs.map((t) => {
            const active = statusFilter === t.key
            return (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                  active
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {t.key !== 'all' && <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[t.key].dot}`} />}
                {t.label}
                <span className={`text-xs ${active ? 'text-slate-300' : 'text-slate-500'}`}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>

        {/* ตัวกรอง */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">จากวันที่</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ถึงวันที่</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-md p-2 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">ค้นหา</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="เลขที่เอกสาร, ชื่อเอกสาร, ผู้ออกตราสาร, ผู้ส่ง"
              className="w-full border rounded-md p-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button onClick={clearFilters} className="w-full border border-slate-300 text-slate-700 rounded-md py-2 text-sm hover:bg-slate-100">
              ล้างตัวกรอง
            </button>
          </div>
        </div>

        {/* ตาราง */}
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left whitespace-nowrap">วันเวลา</th>
                <th className="px-4 py-3 text-left">เอกสาร</th>
                <th className="px-4 py-3 text-left">ผู้ออกตราสาร</th>
                <th className="px-4 py-3 text-left">ผู้ส่ง</th>
                <th className="px-4 py-3 text-left">สถานะ</th>
                <th className="px-4 py-3 text-left">ผู้ดำเนินการ</th>
                <th className="px-4 py-3 text-left">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const s = STATUS_CONFIG[log.status]
                  return (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">{log.datetime}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{log.docName}</div>
                        <div className="text-xs text-slate-500">
                          {log.docNo} · {log.docType}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{log.issuer}</td>
                      <td className="px-4 py-3 text-slate-700">{log.submittedBy}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-full text-xs font-medium ${s.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{log.reviewer ?? <span className="text-slate-400">รอดำเนินการ</span>}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs">{log.remark ?? <span className="text-slate-400">-</span>}</td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    {logs.length === 0
                      ? 'ยังไม่มีประวัติ — เมื่อมีการส่ง อนุมัติ หรือรีเจคเอกสาร จะแสดงที่นี่'
                      : 'ไม่พบประวัติที่ตรงกับตัวกรอง'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ส่วนท้าย */}
        <div className="flex justify-between items-center mt-4">
          <span className="text-sm text-slate-600">
            แสดง {filteredLogs.length} จาก {logs.length} รายการ
          </span>
          <button onClick={handleExportCSV} className="bg-brand text-white px-4 py-2 rounded-md text-sm hover:bg-brand-600">
            Export CSV
          </button>
        </div>
      </div>
    </div>
  )
}
