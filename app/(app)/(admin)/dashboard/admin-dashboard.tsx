'use client'

// แดชบอร์ดผู้ดูแลระบบ — วางที่ app/(app)/(admin)/dashboard/admin-dashboard.tsx
import Link from 'next/link'
import { useMemo } from 'react'
import { Icon, type IconName } from '@/components/shared/icon'
import { useApprovals } from '@/lib/approvals-store'
import { useSession } from '@/lib/use-session'
import { companyOf, symbolOf } from '@/lib/submission-docs'

// ปรับ path ให้ตรงกับเมนูของ role admin (ดู lib/roles.ts)
const LINKS: { href: string; label: string; desc: string; icon: IconName }[] = [
  { href: '/users', label: 'จัดการผู้ใช้', desc: 'กำหนดบทบาท เปิด/ปิดบัญชี', icon: 'gear' },
  { href: '/audit-log', label: 'Audit Log', desc: 'ประวัติการใช้งานระบบ', icon: 'shield' },
  { href: '/bonds', label: 'รายการตราสารหนี้', desc: 'ตราสารและเวอร์ชันปัจจุบัน', icon: 'folder' },
]

const STATUS = {
  pending: {
    label: 'รอตรวจ',
    color: '#fbbf24',
    dot: 'bg-amber-400',
    pill: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  approved: {
    label: 'อนุมัติแล้ว',
    color: '#10b981',
    dot: 'bg-emerald-500',
    pill: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rejected: {
    label: 'ไม่อนุมัติ',
    color: '#f43f5e',
    dot: 'bg-rose-500',
    pill: 'border-rose-200 bg-rose-50 text-rose-600',
  },
} as const
type StatusKey = keyof typeof STATUS

const NO_REVIEWER = 'ยังไม่ระบุ'

const AVATAR_TONES = [
  'bg-sky-100 text-sky-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-orange-100 text-orange-700',
]

function Avatar({ name, className = 'size-8' }: { name: string; className?: string }) {
  const text = name.replace(/^บริษัท\s*/, '').trim()
  let h = 0
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-xs font-bold ${className} ${
        AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
      }`}
    >
      {text.charAt(0).toUpperCase() || '?'}
    </span>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent,
  iconTone,
}: {
  icon: IconName
  label: string
  value: number
  hint: string
  accent: string
  iconTone: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <span className={`grid size-11 place-items-center rounded-xl ${iconTone}`}>
          <Icon name={icon} className="size-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </section>
  )
}

function Donut({
  segments,
  total,
}: {
  segments: { value: number; color: string }[]
  total: number
}) {
  const r = 52
  const C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative grid size-40 shrink-0 place-items-center">
      <svg viewBox="0 0 128 128" className="size-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
        {total > 0 &&
          segments.map((s, i) => {
            if (s.value <= 0) return null
            const len = (s.value / total) * C
            const el = (
              <circle
                key={i}
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-acc}
              />
            )
            acc += len
            return el
          })}
      </svg>
      <div className="absolute text-center leading-tight">
        <p className="text-3xl font-bold text-slate-900">{total}</p>
        <p className="text-[11px] text-slate-400">คำขอทั้งหมด</p>
      </div>
    </div>
  )
}

export function AdminDashboard() {
  const approvals = useApprovals()
  const session = useSession()

  const data = useMemo(() => {
    const counts: Record<StatusKey, number> = { pending: 0, approved: 0, rejected: 0 }
    const companies = new Map<string, { total: number; pending: number }>()
    const workload = new Map<string, number>()
    let unassigned = 0

    for (const i of approvals) {
      counts[i.status as StatusKey] += 1

      const name = companyOf(i) || 'ไม่ระบุบริษัท'
      const c = companies.get(name) ?? { total: 0, pending: 0 }
      c.total += 1
      if (i.status === 'pending') c.pending += 1
      companies.set(name, c)

      if (i.status === 'pending') {
        if (!i.reviewer || i.reviewer === NO_REVIEWER) unassigned += 1
        else workload.set(i.reviewer, (workload.get(i.reviewer) ?? 0) + 1)
      }
    }

    const topCompanies = [...companies.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5)
    const reviewers = [...workload.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    const recent = [...approvals].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6)

    return { counts, topCompanies, reviewers, recent, unassigned, companyCount: companies.size }
  }, [approvals])

  const total = approvals.length
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0)
  const maxCompany = Math.max(1, ...data.topCompanies.map(([, v]) => v.total))
  const maxReviewer = Math.max(1, ...data.reviewers.map(([, n]) => n))
  const today = new Date().toLocaleDateString('th-TH', { dateStyle: 'full' })

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* แบนเนอร์ต้อนรับ */}
      <div className="relative overflow-hidden rounded-3xl bg-navy px-7 pb-16 pt-7 text-white shadow-lg">
        <span className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-brand/30 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-orange-300" suppressHydrationWarning>
              {today}
            </p>
            <h1 className="mt-1 text-2xl font-bold lg:text-3xl">
              สวัสดี{session?.label ? ` ${session.label}` : ''}
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              {data.counts.pending > 0 ? (
                <>
                  ขณะนี้มี <b className="text-white">{data.counts.pending}</b> คำขอรอตรวจ
                  {data.unassigned > 0 && (
                    <>
                      {' '}
                      · <b className="text-amber-300">{data.unassigned}</b> รายการยังไม่มอบหมายผู้ตรวจ
                    </>
                  )}
                </>
              ) : (
                'ไม่มีคำขอค้างตรวจ ระบบทำงานเรียบร้อย'
              )}
            </p>
          </div>
          <Link
            href="/approvals"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-lg shadow-brand/30 transition-colors hover:bg-brand-600"
          >
            ไปหน้าตรวจ / อนุมัติ <Icon name="arrowRight" />
          </Link>
        </div>
      </div>

      {/* ตัวเลขสรุป (ซ้อนทับแบนเนอร์เล็กน้อย) */}
      <div className="relative -mt-14 grid gap-4 px-2 sm:grid-cols-2 xl:grid-cols-4 lg:px-4">
        <StatCard
          icon="doc"
          label="คำขอทั้งหมด"
          value={total}
          hint={`จาก ${data.companyCount} บริษัท`}
          accent="bg-brand"
          iconTone="bg-brand-50 text-brand"
        />
        <StatCard
          icon="clock"
          label="รอตรวจ"
          value={data.counts.pending}
          hint={`${pct(data.counts.pending)}% ของคำขอทั้งหมด`}
          accent="bg-amber-400"
          iconTone="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon="check"
          label="อนุมัติแล้ว"
          value={data.counts.approved}
          hint={`${pct(data.counts.approved)}% ของคำขอทั้งหมด`}
          accent="bg-emerald-500"
          iconTone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          icon="close"
          label="ไม่อนุมัติ"
          value={data.counts.rejected}
          hint={`${pct(data.counts.rejected)}% ของคำขอทั้งหมด`}
          accent="bg-rose-500"
          iconTone="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="สัดส่วนสถานะคำขอ" subtitle="เทียบจากคำขอทั้งหมดในระบบ">
          {total === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">ยังไม่มีคำขอในระบบ</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Donut
                total={total}
                segments={(Object.keys(STATUS) as StatusKey[]).map((k) => ({
                  value: data.counts[k],
                  color: STATUS[k].color,
                }))}
              />
              <ul className="min-w-[150px] flex-1 space-y-3 text-xs">
                {(Object.keys(STATUS) as StatusKey[]).map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${STATUS[k].dot}`} />
                    <span className="flex-1 text-slate-600">{STATUS[k].label}</span>
                    <b className="text-slate-900">{data.counts[k]}</b>
                    <span className="w-9 text-right text-slate-400">{pct(data.counts[k])}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="คำขอแยกตามบริษัท" subtitle="5 บริษัทที่ส่งมากที่สุด">
          {data.topCompanies.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">ยังไม่มีข้อมูล</p>
          ) : (
            <ul className="space-y-4">
              {data.topCompanies.map(([name, v]) => (
                <li key={name} className="flex items-center gap-3">
                  <Avatar name={name} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-semibold text-slate-800">{name}</span>
                      <span className="shrink-0 text-slate-500">
                        {v.total} รายการ
                        {v.pending > 0 && (
                          <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            รอตรวจ {v.pending}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-orange-400 to-brand"
                        style={{ width: `${(v.total / maxCompany) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="งานค้างของผู้ตรวจ" subtitle="เฉพาะคำขอที่ยังรอตรวจ">
          {data.counts.pending === 0 ? (
            <div className="grid h-full place-items-center py-10 text-center">
              <div>
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icon name="check" className="size-6" />
                </span>
                <p className="mt-3 text-sm text-slate-500">ไม่มีงานค้าง</p>
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {data.unassigned > 0 && (
                <li className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <Icon name="info" className="size-4" />
                  </span>
                  <span className="flex-1 text-xs font-semibold text-amber-800">ยังไม่มอบหมายผู้ตรวจ</span>
                  <b className="text-lg text-amber-800">{data.unassigned}</b>
                </li>
              )}
              {data.reviewers.map(([name, n]) => (
                <li key={name} className="flex items-center gap-3">
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-semibold text-slate-800">{name}</span>
                      <span className="text-slate-500">{n} รายการ</span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full bg-amber-400"
                        style={{ width: `${(n / maxReviewer) * 100}%` }}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title="คำขอล่าสุด"
          subtitle="6 รายการล่าสุดที่ส่งเข้าระบบ"
          className="lg:col-span-2"
          right={
            <Link href="/approvals/history" className="text-xs font-semibold text-brand hover:underline">
              ดูทั้งหมด
            </Link>
          }
        >
          {data.recent.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">ยังไม่มีคำขอในระบบ</p>
          ) : (
            <ul className="-my-1 divide-y divide-slate-100">
              {data.recent.map((i) => {
                const s = STATUS[i.status as StatusKey]
                return (
                  <li key={i.id} className="flex items-center gap-4 py-3">
                    <Avatar name={companyOf(i) || symbolOf(i) || '?'} className="size-10" />
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-bold text-slate-900">{symbolOf(i) || '—'}</p>
                      <p className="truncate text-xs text-slate-400">
                        {companyOf(i) || '—'} · ผู้ส่ง {i.submitter}
                      </p>
                    </div>
                    <div className="hidden text-right text-xs leading-tight sm:block">
                      <p className="font-semibold text-slate-700">{i.version}</p>
                      <p className="text-slate-400">{i.submittedAt}</p>
                    </div>
                    <span
                      className={`w-24 shrink-0 rounded-full border px-3 py-1 text-center text-[11px] font-semibold ${s.pill}`}
                    >
                      {s.label}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>

        <Panel title="เมนูผู้ดูแลระบบ" subtitle="ทางลัดไปยังหน้าที่ใช้บ่อย">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="group flex flex-col rounded-xl border border-slate-200 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/50 hover:bg-brand-50/50 hover:shadow-sm"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon name={l.icon} className="size-5" />
                </span>
                <span className="mt-3 text-xs font-bold text-slate-900">{l.label}</span>
                <span className="mt-0.5 text-[11px] leading-snug text-slate-500">{l.desc}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  )
}
