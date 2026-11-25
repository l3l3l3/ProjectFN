'use client'

import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import BondDataSheet from './BondDataSheet'
import { fieldValue, formatSize } from './bond-config'
import type { BondData } from './bond-config'

/* ---------- ข้อมูลที่ใช้ออกใบรับเอกสาร ---------- */
export type ReceiptInfo = {
  docNo: string
  issuedAt: Date
  templateName: string
  submitter: string
  data: BondData
  attachments: { label: string; name: string; size: number }[]
}

/* ---------- ใบรับเอกสาร (หน้าตาคล้าย invoice) + สำเนาข้อมูลตราสารหนี้ต่อท้าย ---------- */
export function ReceiptDocument({ receipt }: { receipt: ReceiptInfo }) {
  const { data, attachments } = receipt

  const issuedDate = receipt.issuedAt.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const issuedTime = receipt.issuedAt.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  })

  const symbol = fieldValue(data, 'symbol')
  const issuer = fieldValue(data, 'issuer')

  // รายการในตาราง: แบบข้อมูลตราสารหนี้ 1 รายการ + ไฟล์แนบทุกไฟล์
  const lines = [
    { title: `แบบข้อมูลตราสารหนี้ (${symbol})`, detail: receipt.templateName, status: 'ส่งแล้ว' },
    ...attachments.map((a) => ({
      title: a.label,
      detail: `${a.name} (${formatSize(a.size)})`,
      status: 'แนบแล้ว',
    })),
  ]

  // ข้อมูลสำคัญของตราสาร
  const facts: [string, string][] = [
    ['Symbol', symbol],
    ['Issuer', issuer],
    ['ISIN Code (Local)', fieldValue(data, 'isinLocal')],
    ['Bond Type', fieldValue(data, 'bondType')],
    ['Issue Size', fieldValue(data, 'issueSize')],
    ['Payment Frequency', fieldValue(data, 'paymentFrequency')],
    ['Issue Date', fieldValue(data, 'issueDate')],
    ['Maturity Date', fieldValue(data, 'maturityDate')],
  ]

  return (
    <div className="text-gray-900">
      {/* ===== หน้า 1: ใบรับเอกสาร ===== */}
      <section data-pdf-section="receipt" className="w-full bg-white text-gray-900">
        {/* หัวเอกสาร */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-brand pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">
              ต
            </span>
            <div>
              <p className="text-base font-bold leading-tight">ตราสารหนี้</p>
              <p className="text-[10px] tracking-wider text-gray-500">DOCUMENT MANAGEMENT</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xl font-bold text-brand-600">ใบรับเอกสาร</p>
            <p className="text-[11px] text-gray-500">Document Receipt</p>
          </div>
        </div>

        {/* เลขที่เอกสาร / วันที่ / ผู้ยื่น */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <p className="font-semibold text-gray-500">ผู้ยื่นเอกสาร</p>
            <p className="text-sm font-bold">{issuer}</p>
            <p className="text-gray-600">ตราสาร: {symbol}</p>
            <p className="text-gray-600">ส่งโดย: {receipt.submitter}</p>
          </div>

          <div className="space-y-1 text-right">
            <p>
              <span className="text-gray-500">เลขที่เอกสาร: </span>
              <span className="font-bold">{receipt.docNo}</span>
            </p>
            <p>
              <span className="text-gray-500">วันที่ออกเอกสาร: </span>
              {issuedDate}
            </p>
            <p>
              <span className="text-gray-500">เวลา: </span>
              {issuedTime} น.
            </p>
            <p>
              <span className="text-gray-500">สถานะ: </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-700">
                รอตรวจสอบ
              </span>
            </p>
          </div>
        </div>

        {/* ตารางรายการ (แบบ invoice) */}
        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="bg-brand text-white">
              <th className="w-10 px-3 py-2 text-center font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">รายการ</th>
              <th className="px-3 py-2 text-left font-semibold">รายละเอียด</th>
              <th className="w-24 px-3 py-2 text-center font-semibold">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="break-inside-avoid border-b border-gray-200">
                <td className="px-3 py-2 text-center text-gray-500">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{line.title}</td>
                <td className="break-all px-3 py-2 text-gray-600">{line.detail}</td>
                <td className="px-3 py-2 text-center">{line.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-brand-50">
              <td colSpan={3} className="px-3 py-2 text-right font-semibold">
                รวมเอกสารทั้งหมด
              </td>
              <td className="px-3 py-2 text-center font-bold">{lines.length} รายการ</td>
            </tr>
          </tfoot>
        </table>

        {/* สรุปข้อมูลตราสาร */}
        <h3 className="mt-6 text-sm font-bold">สรุปข้อมูลตราสารหนี้</h3>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-lg border border-gray-200 p-4 text-xs">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 border-b border-dashed border-gray-200 pb-1">
              <dt className="text-gray-500">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {/* หมายเหตุท้ายเอกสาร */}
        <p className="mt-6 text-[11px] leading-relaxed text-gray-500">
          เอกสารฉบับนี้ออกโดยระบบอัตโนมัติ เพื่อเป็นหลักฐานการยื่นเอกสารและรอการตรวจสอบ
          โปรดเก็บไว้อ้างอิงพร้อมเลขที่เอกสาร ({receipt.docNo}) โดยสำเนาข้อมูลตราสารหนี้ฉบับเต็มอยู่ในหน้าถัดไป
        </p>
      </section>

      {/* ===== หน้า 2: สำเนาข้อมูลตราสารหนี้ ===== */}
      <section data-pdf-section="bond" className="mt-10 w-full bg-white text-gray-900" style={{ breakBefore: 'page' }}>
        <h3 className="mb-3 text-sm font-bold">
          สำเนาข้อมูลตราสารหนี้ <span className="font-normal text-gray-500">(Bond Data Sheet)</span>
        </h3>
        <BondDataSheet data={data} />
      </section>
    </div>
  )
}

/* ---------- แบบฟอร์มข้อมูลตราสารหนี้ฉบับเปล่า (ปุ่ม "ดาวน์โหลดเอกสาร") ---------- */
export function BlankForm() {
  return (
    <div className="text-gray-900">
      <h1 className="text-base font-bold">แบบฟอร์มข้อมูลตราสารหนี้</h1>
      <p className="mb-3 text-xs text-gray-500">Bond Data Sheet (ฉบับเปล่า)</p>
      <BondDataSheet data={null} />
    </div>
  )
}

/* ---------- ตัวช่วยพิมพ์ / บันทึกเป็น PDF ----------
   วางเนื้อหาไว้เป็นลูกตรงของ <body> (ผ่าน portal) แล้วซ่อนทุกอย่างอื่นตอนพิมพ์
   ผลคือพิมพ์เฉพาะเอกสาร ไม่ติดเมนู/แถบหัวของเว็บ และข้ามหน้ากระดาษได้ถูกต้อง
   ต้องเรียกใช้หลังจากผู้ใช้กดปุ่มเท่านั้น (ใช้ document จึงห้าม render ตอนโหลดหน้า) */
export function PrintPortal({ children }: { children: ReactNode }) {
  return createPortal(
    <div id="print-portal">
      {children}
      <style>{`
        @media screen { #print-portal { display: none; } }
        @media print {
          body > *:not(#print-portal) { display: none !important; }
          #print-portal { display: block; }
          @page { size: A4; margin: 12mm; }
        }
        #print-portal * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>
    </div>,
    document.body
  )
}