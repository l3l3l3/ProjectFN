
'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApprovals } from '@/lib/approvals-store'
import { Search, History, FileText, ArrowRight, GitCompareArrows } from 'lucide-react'

export default function VersionsPage() {
  const router = useRouter()
  const items = useApprovals()
  const [keyword, setKeyword] = useState('')

  const documents = useMemo(() => {
    const search = keyword.trim().toLowerCase()

    return [...items]
      .filter((item) => {
        return (
          !search ||
          item.title.toLowerCase().includes(search) ||
          item.submitter.toLowerCase().includes(search) ||
          String(item.id).includes(search)
        )
      })
      .sort((a, b) => b.id - a.id)
  }, [items, keyword])

  return (
    <div className="min-h-full space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            ประวัติเวอร์ชันเอกสาร
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            เลือกเอกสารเพื่อดูประวัติและเปรียบเทียบเวอร์ชันย้อนหลัง
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-3">
          <History className="h-5 w-5 text-brand" />
          <div>
            <p className="text-xs text-slate-500">เอกสารทั้งหมด</p>
            <p className="text-lg font-bold text-brand-600">
              {documents.length} รายการ
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <Search className="h-5 w-5 shrink-0 text-slate-400" />
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="ค้นหาชื่อเอกสาร ผู้ส่ง หรือเลขที่รายการ..."
          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Document list */}
      <div className="overflow-hidden rounded-xl border border-orange-100 bg-white">
        <div className="border-b border-orange-100 bg-brand-50 px-5 py-4">
          <h2 className="font-semibold text-slate-800">
            รายการเอกสาร
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            กดเปรียบเทียบที่เอกสารที่ต้องการ ระบบจะเปิดประวัติของเอกสารนั้นทันที
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <FileText className="mb-3 h-12 w-12 text-slate-300" />
            <p className="font-medium text-slate-600">
              ไม่พบเอกสาร
            </p>
            <p className="mt-1 text-sm text-slate-400">
              ลองค้นหาด้วยชื่อเอกสารหรือเลขที่รายการอื่น
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-brand-50/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50">
                    <FileText className="h-5 w-5 text-brand" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {item.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span>รหัส #{item.id}</span>
                      <span>ผู้ส่ง: {item.submitter}</span>
                      <span>วันที่ส่ง: {item.submittedAt}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-xs text-slate-400">เวอร์ชันล่าสุด</p>
                    <p className="font-semibold text-brand-600">
                      {item.version}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/tracking/versions/${item.id}`)
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-brand bg-white px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand hover:text-white"
                  >
                    <GitCompareArrows className="h-4 w-4" />
                    เปรียบเทียบ
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
