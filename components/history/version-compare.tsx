'use client'

// หน้าเปรียบเทียบเวอร์ชัน (ใช้ร่วมกันทั้งฝั่งผู้ส่งและเจ้าหน้าที่) — วางที่ components/history/version-compare.tsx
// ต้องติดตั้ง: npm i pdfjs-dist  (ใช้วาด PDF เป็นภาพเต็มหน้า แทน iframe ที่เลื่อนในกรอบและเพี้ยนตอนซูม)
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useApprovals } from '@/lib/approvals-store'
import { useSession } from '@/lib/use-session'
import { allowedCompanies, matchesCompany } from '@/lib/company-access'
import {
  bondSheetUrl,
  companyOf,
  docUrl,
  isBondSheetLabel,
  isMine,
  symbolOf,
  versionsOf,
  type ApprovalFile,
  type StoredDocument,
  type VersionEntry,
} from '@/lib/submission-docs'

const selectCls =
  'h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand'

const pillCls =
  'rounded-full border border-orange-200 bg-brand-50 px-3 py-1 text-[11px] font-semibold text-brand'

const thCls = 'px-4 py-3 text-left'
const tdCls = 'px-4 py-3 text-xs'

// ค่าที่กรอกในแบบข้อมูลตราสารหนี้ของแต่ละเวอร์ชัน (มีเฉพาะถ้าระบบเก็บไว้ในเวอร์ชันนั้น)
type RawValues = Record<string, unknown>
const pickValues = (src: unknown): Record<string, string> | null => {
  const raw = src as {
    bondData?: { values?: RawValues }
    values?: RawValues
    formValues?: RawValues
  } | null | undefined
  const v = raw?.bondData?.values ?? raw?.values ?? raw?.formValues
  if (!v || typeof v !== 'object') return null
  const out: Record<string, string> = {}
  for (const [k, x] of Object.entries(v)) out[k] = x == null ? '' : String(x).trim()
  return Object.keys(out).length ? out : null
}

// เวอร์ชันเก่าที่ไม่ได้เก็บค่าไว้ → ถ้าเป็นเวอร์ชันล่าสุด ใช้ข้อมูลปัจจุบันของรายการ (item.bondData) แทน
const valuesOf = (entry: VersionEntry | undefined, item: unknown, isLatest: boolean) =>
  pickValues(entry) ?? (isLatest ? pickValues(item) : null)

const fileKey = (f: ApprovalFile) => f.documentType || f.name

// registrationDate → Registration Date (ชื่อคีย์เดิมแสดงเป็นตัวเล็กใต้ชื่อ)
const prettyKey = (k: string) =>
  k
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())

/* ---------- แสดง PDF เป็นภาพเต็มหน้า (ไม่มีแถบเลื่อนซ้อน เลื่อนไปพร้อมหน้าเว็บ) ---------- */
type PdfPageProxy = {
  getViewport: (o: { scale: number }) => { width: number; height: number }
  render: (o: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
  }) => { promise: Promise<void>; cancel: () => void }
}
type PdfDoc = {
  numPages: number
  getPage: (n: number) => Promise<PdfPageProxy>
  destroy?: () => void
}

function PdfCanvasPage({ pdf, pageNo, width }: { pdf: PdfDoc; pageNo: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!width) return
    let cancelled = false
    let task: { promise: Promise<void>; cancel: () => void } | null = null
    ;(async () => {
      const page = await pdf.getPage(pageNo)
      if (cancelled) return
      const base = page.getViewport({ scale: 1 })
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: (width / base.width) * dpr })
      // วาดลงผืนผ้าใบสำรองก่อน แล้วค่อยสลับเข้าจอ เพื่อไม่ให้ภาพกระพริบตอนซูม
      const off = document.createElement('canvas')
      off.width = Math.floor(viewport.width)
      off.height = Math.floor(viewport.height)
      const ctx = off.getContext('2d')
      if (!ctx) return
      task = page.render({ canvasContext: ctx, viewport })
      await task.promise
      if (cancelled) return
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = off.width
      canvas.height = off.height
      canvas.getContext('2d')?.drawImage(off, 0, 0)
      setReady(true)
    })().catch(() => {})
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdf, pageNo, width])

  return (
    <>
      {!ready && <div className="aspect-[1/1.414] w-full animate-pulse bg-white" />}
      <canvas
        ref={canvasRef}
        className={`block h-auto w-full bg-white shadow-sm ${ready ? '' : 'hidden'}`}
      />
    </>
  )
}

function PdfPages({ url }: { url: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pdf, setPdf] = useState<PdfDoc | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [width, setWidth] = useState(0)

  // โหลดไฟล์ PDF
  useEffect(() => {
    let cancelled = false
    let doc: PdfDoc | null = null
    setState('loading')
    setPdf(null)
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        doc = (await pdfjs.getDocument({ url }).promise) as unknown as PdfDoc
        if (cancelled) return
        setPdf(doc)
        setState('ready')
      } catch (e) {
        console.error('Load PDF error:', e)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
      doc?.destroy?.()
    }
  }, [url])

  // ติดตามความกว้าง + ระดับซูมของเบราว์เซอร์ (devicePixelRatio) แล้ววาดใหม่ให้คมโดยไม่ค้าง
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setWidth(Math.round(el.clientWidth)), 150)
    }
    setWidth(Math.round(el.clientWidth))
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      clearTimeout(timer)
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div ref={wrapRef} className="flex flex-col gap-3 bg-slate-100 p-3">
      {state === 'loading' && <div className="aspect-[1/1.414] w-full animate-pulse bg-white" />}
      {state === 'error' && (
        <div className="grid h-40 place-items-center gap-2 bg-white px-4 text-center text-sm text-slate-400">
          <p>เปิดไฟล์ PDF ของเวอร์ชันนี้ไม่ได้ (ไฟล์อาจยังไม่ถูกบันทึกในคลังเอกสาร หรือระบบส่งหน้าอื่นกลับมา)</p>
          <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">
            ลองเปิดไฟล์ในแท็บใหม่
          </a>
        </div>
      )}
      {pdf &&
        Array.from({ length: pdf.numPages }, (_, i) => (
          <PdfCanvasPage key={`${url}-${i}`} pdf={pdf} pageNo={i + 1} width={width} />
        ))}
    </div>
  )
}

type Tab = 'diff' | 'pdf' | 'files'

// ป้ายเล็กบอกว่าเป็นเวอร์ชันปัจจุบัน (ล่าสุด)
function CurrentTag() {
  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      ปัจจุบัน
    </span>
  )
}

export function VersionCompare({
  backHref,
  mode = 'agent',
  itemId,
  onClose,
}: {
  backHref?: string // ใช้เมื่อเปิดเป็นหน้า (route)
  mode?: 'agent' | 'officer'
  itemId?: string | number // ใช้เมื่อเปิดเป็นหน้าต่างซ้อน (ไม่ต้องเปลี่ยนหน้า)
  onClose?: () => void
}) {
  const params = useParams<{ id: string }>()
  const id = String(itemId ?? params?.id ?? '')
  const session = useSession()
  const approvals = useApprovals()

  const [storedDocs, setStoredDocs] = useState<StoredDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [leftIdx, setLeftIdx] = useState<number | null>(null)
  const [rightIdx, setRightIdx] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('diff')
  const [showAll, setShowAll] = useState(false) // แสดงทุกช่อง (ไม่ใช่เฉพาะที่ต่าง)

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
  const item = useMemo(() => approvals.find((i) => String(i.id) === id), [approvals, id])
  // เจ้าหน้าที่ (officer) เห็นทุกบริษัทอยู่แล้ว ส่วนฝั่งผู้ส่งจำกัดตามบริษัท
  const allowed =
    !!item &&
    (mode === 'officer' || scope === 'all' || isMine(item) || matchesCompany(companyOf(item), scope))

  const versions = useMemo(() => (item ? versionsOf(item) : []), [item])
  const left = leftIdx ?? Math.max(versions.length - 2, 0)
  const right = rightIdx ?? Math.max(versions.length - 1, 0)
  const a = versions[left]
  const b = versions[right]

  const urlA = item && a ? bondSheetUrl(item, a, versions, storedDocs) : null
  const urlB = item && b ? bondSheetUrl(item, b, versions, storedDocs) : null

  // เทียบไฟล์แนบ (ไม่รวมแบบข้อมูลตราสารหนี้ เพราะแสดง PDF ในแท็บ "ดู PDF เทียบกัน")
  const fileRows = useMemo(() => {
    const pick = (e?: VersionEntry) =>
      (e?.files ?? []).filter((f) => !isBondSheetLabel(`${f.documentType || ''} ${f.name || ''}`))
    const fa = pick(a)
    const fb = pick(b)
    const keys = Array.from(new Set([...fa.map(fileKey), ...fb.map(fileKey)]))
    return keys.map((k) => {
      const x = fa.find((f) => fileKey(f) === k)
      const y = fb.find((f) => fileKey(f) === k)
      const state = !x ? 'added' : !y ? 'removed' : x.name !== y.name || x.version !== y.version ? 'changed' : 'same'
      return { key: k, x, y, state }
    })
  }, [a, b])

  const latestVersion = versions[versions.length - 1]?.version
  const isCurrent = (e?: VersionEntry) => !!e && e.version === latestVersion

  // เทียบค่าที่กรอก (ถ้ามีข้อมูลอย่างน้อยหนึ่งฝั่ง)
  const valueInfo = useMemo(() => {
    const va = valuesOf(a, item, !!a && a.version === latestVersion)
    const vb = valuesOf(b, item, !!b && b.version === latestVersion)
    if (!va && !vb) return null
    const A = va ?? {}
    const B = vb ?? {}
    const keys = Array.from(new Set([...Object.keys(A), ...Object.keys(B)]))
    const all = keys.map((k) => {
      const x = A[k] ?? ''
      const y = B[k] ?? ''
      return { key: k, x, y, changed: x !== y }
    })
    return {
      all,
      // ฝั่งที่ไม่มีข้อมูลเก็บไว้ (ใช้เตือนผู้ใช้ ไม่ให้เข้าใจผิดว่า "ทุกช่องเปลี่ยน")
      missing: !va ? a?.version : !vb ? b?.version : undefined,
    }
  }, [a, b, item, latestVersion])

  const valueRows = useMemo(() => valueInfo?.all.filter((r) => r.changed) ?? null, [valueInfo])
  const displayRows = showAll ? (valueInfo?.all ?? []) : (valueRows ?? [])

  const changedFiles = fileRows.filter((r) => r.state !== 'same').length
  const sameVersion = left === right

  const backLink = (cls: string) =>
    onClose ? (
      <button type="button" onClick={onClose} className={cls}>
        ปิด
      </button>
    ) : (
      <Link href={backHref ?? '/'} className={cls}>
        กลับ
      </Link>
    )

  if (!item) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-sm text-slate-500">
          {approvals.length === 0 ? 'กำลังโหลด…' : `ไม่พบรายการ #${id} (มี ${approvals.length} รายการในระบบ)`}
        </p>
        {backLink('mt-3 inline-block text-sm text-brand-600 underline')}
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="p-6 lg:p-8">
        <p className="text-sm text-red-600">คุณไม่มีสิทธิ์ดูรายการนี้</p>
        {backLink('mt-3 inline-block text-sm text-brand-600 underline')}
      </div>
    )
  }

  const pdfPane = (entry: VersionEntry | undefined, url: string | null) => (
    <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={pillCls}>{entry?.version ?? '—'}</span>
          {isCurrent(entry) && <CurrentTag />}
          <p className="truncate text-xs text-slate-500">ส่งเมื่อ {entry?.submittedAt || '—'}</p>
        </div>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-50"
          >
            เปิดแท็บใหม่
          </a>
        )}
      </div>
      {url ? (
        <PdfPages url={url} />
      ) : (
        <div className="grid h-40 place-items-center bg-slate-50/60 text-sm text-slate-400">
          {docsLoading ? 'กำลังโหลด…' : 'ไม่พบไฟล์ PDF ของเวอร์ชันนี้'}
        </div>
      )}
    </div>
  )

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'diff', label: 'ความแตกต่าง', count: valueRows?.length },
    { key: 'pdf', label: 'ดู PDF เทียบกัน' },
    { key: 'files', label: 'ไฟล์แนบ', count: changedFiles },
  ]

  return (
    <div className="space-y-5 p-6 lg:p-8">
      {/* แถวบน: ชื่อเอกสาร + เลือกเวอร์ชันในบรรทัดเดียว */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">
            {symbolOf(item) || 'เปรียบเทียบเวอร์ชัน'}
            <span className="ml-3 text-sm font-normal text-slate-500">{companyOf(item)}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={left}
            onChange={(e) => setLeftIdx(Number(e.target.value))}
            aria-label="เวอร์ชันต้นทาง"
            className={selectCls}
          >
            {versions.map((v, i) => (
              <option key={`${v.version}-${i}`} value={i}>
                {v.version}
                {v.version === latestVersion ? ' (ปัจจุบัน)' : ''} · {v.submittedAt}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setLeftIdx(right)
              setRightIdx(left)
            }}
            aria-label="สลับเวอร์ชัน"
            title="สลับเวอร์ชัน"
            className="grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            ⇄
          </button>
          <select
            value={right}
            onChange={(e) => setRightIdx(Number(e.target.value))}
            aria-label="เวอร์ชันปลายทาง"
            className={selectCls}
          >
            {versions.map((v, i) => (
              <option key={`${v.version}-${i}`} value={i}>
                {v.version}
                {v.version === latestVersion ? ' (ปัจจุบัน)' : ''} · {v.submittedAt}
              </option>
            ))}
          </select>
          {backLink(
            'rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-brand shadow-sm hover:bg-brand-50',
          )}
        </div>
      </div>

      {versions.length < 2 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          รายการนี้มีเวอร์ชันเดียว ยังไม่มีอะไรให้เปรียบเทียบ
        </p>
      ) : (
        <>
          {/* สรุปภาพรวม */}
          <p className="rounded-xl border border-orange-100 bg-brand-50 px-4 py-2.5 text-xs text-slate-600">
            <b className="text-slate-900">สรุป:</b> {a?.version} → {b?.version} ·{' '}
            {sameVersion
              ? 'เลือกเวอร์ชันเดียวกัน กรุณาเลือกเวอร์ชันที่ต่างกัน'
              : valueRows
                ? `แก้ไข ${valueRows.length} ช่อง`
                : 'ไม่มีข้อมูลที่กรอกให้เทียบ'}{' '}
            · ไฟล์แนบเปลี่ยน {changedFiles} ไฟล์
          </p>

          {/* แท็บ ไม่ต้องเปลี่ยนหน้า */}
          <div role="tablist" className="flex gap-1 border-b border-slate-200">
            {tabs.map((t) => {
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {tab === 'diff' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {!valueInfo ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">
                  เวอร์ชันนี้ไม่ได้เก็บค่าที่กรอกไว้ให้เทียบ ดูความต่างได้ที่แท็บ “ดู PDF เทียบกัน”
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
                    <p className="text-xs text-slate-500">
                      {valueInfo.missing
                        ? `เวอร์ชัน ${valueInfo.missing} ไม่ได้เก็บค่าที่กรอกไว้ จึงแสดงเป็น “—”`
                        : `ต่างกัน ${valueRows?.length ?? 0} จาก ${valueInfo.all.length} ช่อง`}
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        checked={showAll}
                        onChange={(e) => setShowAll(e.target.checked)}
                        className="size-4 accent-[var(--color-brand)]"
                      />
                      แสดงทุกช่อง
                    </label>
                  </div>
                  {displayRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">ข้อมูลที่กรอกไม่ต่างกัน</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-surface text-xs font-bold text-slate-600">
                        <th className={thCls}>ช่อง</th>
                        <th className={thCls}>
                          <span className="inline-flex items-center gap-2">
                            {a?.version} {isCurrent(a) && <CurrentTag />}
                          </span>
                        </th>
                        <th className={thCls}>
                          <span className="inline-flex items-center gap-2">
                            {b?.version} {isCurrent(b) && <CurrentTag />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map((r) => (
                        <tr key={r.key} className="border-b border-slate-100 last:border-0">
                          <td className={tdCls}>
                            <p className="font-bold text-slate-800">{prettyKey(r.key)}</p>
                            <p className="font-mono text-[10px] text-slate-400">{r.key}</p>
                          </td>
                          <td className={tdCls}>
                            <span
                              className={`rounded-md px-2 py-1 ${r.changed ? 'bg-rose-50 text-rose-600' : 'text-slate-600'}`}
                            >
                              {r.x || '—'}
                            </span>
                          </td>
                          <td className={tdCls}>
                            <span
                              className={`rounded-md px-2 py-1 ${r.changed ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600'}`}
                            >
                              {r.y || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {tab === 'pdf' && (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
              {pdfPane(a, urlA)}
              {pdfPane(b, urlB)}
            </div>
          )}

          {tab === 'files' && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {fileRows.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-400">ไม่มีไฟล์แนบ</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-surface text-xs font-bold text-slate-600">
                        <th className={thCls}>เอกสาร</th>
                        <th className={thCls}>
                          <span className="inline-flex items-center gap-2">
                            {a?.version} {isCurrent(a) && <CurrentTag />}
                          </span>
                        </th>
                        <th className={thCls}>
                          <span className="inline-flex items-center gap-2">
                            {b?.version} {isCurrent(b) && <CurrentTag />}
                          </span>
                        </th>
                        <th className={`${thCls} text-center`}>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fileRows.map((r) => {
                        const cell = (f?: ApprovalFile) =>
                          f?.documentId && f.version ? (
                            <a
                              href={docUrl(f.documentId, f.version)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand underline-offset-2 hover:underline"
                            >
                              {f.name}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )
                        const badge =
                          r.state === 'added'
                            ? ['เพิ่มใหม่', 'border-emerald-200 bg-emerald-50 text-emerald-700']
                            : r.state === 'removed'
                              ? ['ถูกเอาออก', 'border-rose-200 bg-rose-50 text-rose-600']
                              : r.state === 'changed'
                                ? ['มีการเปลี่ยนไฟล์', 'border-amber-200 bg-amber-50 text-amber-700']
                                : ['เหมือนเดิม', 'border-slate-200 bg-slate-100 text-slate-500']
                        return (
                          <tr key={r.key} className="border-b border-slate-100 last:border-0">
                            <td className={`${tdCls} font-bold text-slate-800`}>{r.key}</td>
                            <td className={tdCls}>{cell(r.x)}</td>
                            <td className={tdCls}>{cell(r.y)}</td>
                            <td className={`${tdCls} text-center`}>
                              <span
                                className={`inline-block rounded-full border px-3 py-1 text-[11px] font-semibold ${badge[1]}`}
                              >
                                {badge[0]}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
