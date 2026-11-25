'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BondFormDialog from './BondFormDialog'
import SupportingDocs, { DOC_SLOTS } from './SupportingDocs'
import { PrintPortal, ReceiptDocument } from './ReceiptDocument'
import type { ReceiptInfo } from './ReceiptDocument'
import { TEMPLATES, emptyBondData, fieldValue, makeDocNo } from './bond-config'
import type { BondData, TemplateDef } from './bond-config'
import { addApproval, attachReceipt } from '@/lib/approvals-store'

export default function ReviewPage() {
  const router = useRouter()

  /* ----- ข้อมูลของฟอร์ม ----- */
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [bond, setBond] = useState<BondData | null>(null)
  const [docs, setDocs] = useState<Record<string, File | null>>({})

  /* ----- สถานะหน้าจอ ----- */
  const [dialogInitial, setDialogInitial] = useState<BondData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null)
  const [printing, setPrinting] = useState(false)
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const receiptElementRef = useRef<HTMLDivElement>(null)
  const autoPdfFor = useRef<string | null>(null)

  const selected: TemplateDef | null =
    TEMPLATES.find((t) => t.id === templateId) ?? null

  /* ----- สิ่งที่ยังขาดก่อนส่งได้ ----- */
  const missing: string[] = []
  if (!selected) missing.push('เลือกเทมเพลต')
  else if (!bond) missing.push('กรอกข้อมูลตราสารหนี้ในเทมเพลต')

  const missingDocs = DOC_SLOTS.filter(
    (s) => s.required && !docs[s.key]
  ).length

  if (missingDocs > 0) {
    missing.push(`แนบเอกสารที่จำเป็นอีก ${missingDocs} รายการ`)
  }

  const canSubmit = missing.length === 0
  const isDirty =
    templateId !== null || Object.values(docs).some(Boolean)

  /* ----- พิมพ์ / บันทึกใบรับเอกสารเป็น PDF ----- */
  useEffect(() => {
    if (!printing) return

    const previousTitle = document.title
    if (receipt) document.title = receipt.docNo

    const finish = () => setPrinting(false)
    window.addEventListener('afterprint', finish, { once: true })

    const timer = setTimeout(() => window.print(), 100)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', finish)
      document.title = previousTitle
    }
  }, [printing, receipt])

  /* ----- สร้าง PDF แยก 2 ไฟล์และบันทึกอัตโนมัติ (ไม่กระทบการส่งเอกสาร) ----- */
  useEffect(() => {
    if (!receipt || !receiptElementRef.current) return
    // ใช้เวลาส่งร่วมด้วย เพื่อให้การส่งเอกสารเดิมซ้ำในวันเดียวกันสร้าง PDF Version ใหม่ได้
    const pdfRunKey = `${receipt.docNo}-${receipt.issuedAt.getTime()}`
    if (autoPdfFor.current === pdfRunKey) return

    // เลือกส่วนเอกสารด้วย data attribute โดยตรง
    // ไม่ใช้ querySelectorAll('section') เพราะ BondDataSheet อาจมี section ซ้อนอยู่
    const receiptSection = receiptElementRef.current.querySelector<HTMLElement>(
      '[data-pdf-section="receipt"]'
    )
    const bondSection = receiptElementRef.current.querySelector<HTMLElement>(
      '[data-pdf-section="bond"]'
    )
    if (!receiptSection || !bondSection) {
      console.error('ไม่พบส่วนเอกสารสำหรับสร้าง PDF', {
        receiptSection: Boolean(receiptSection),
        bondSection: Boolean(bondSection),
      })
      setPdfStatus('error')
      autoPdfFor.current = pdfRunKey
      return
    }

    autoPdfFor.current = pdfRunKey

    const saveGeneratedPdfs = async () => {
      setPdfStatus('saving')

      try {
        const stylesheets = Array.from(
          document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
        ).map((link) => link.href)

        const inlineStyles = Array.from(document.head.querySelectorAll('style'))
          .map((style) => style.textContent || '')
          .filter(Boolean)

        const response = await fetch('/api/documents/generate-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin: window.location.origin,
            stylesheets,
            inlineStyles,
            receiptHtml: receiptSection.outerHTML,
            bondHtml: bondSection.outerHTML,
          }),
        })

        const generated = await response.json()
        if (!response.ok || !generated.receiptPdf || !generated.bondPdf) {
          throw new Error(generated.error || 'สร้าง PDF ไม่สำเร็จ')
        }

        const uploadPdf = async (
          base64: string,
          fileName: string,
          documentType: string
        ) => {
          const binary = atob(base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
          }

          const formData = new FormData()
          formData.append(
            'file',
            new File([bytes], fileName, { type: 'application/pdf' })
          )
          formData.append('issuer', fieldValue(receipt.data, 'issuer'))
          formData.append('symbol', fieldValue(receipt.data, 'symbol'))
          formData.append('documentType', documentType)
          formData.append('title', `${fieldValue(receipt.data, 'symbol')} — ${fieldValue(receipt.data, 'issuer')}`)

          const uploadResponse = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
          })
          const uploadResult = await uploadResponse.json()

          if (!uploadResponse.ok || !uploadResult.document?.id) {
            throw new Error(uploadResult.error || `บันทึก ${documentType} ไม่สำเร็จ`)
          }
        }

        await uploadPdf(
          generated.receiptPdf,
          `${receipt.docNo}-ใบรับเอกสาร.pdf`,
          'ใบรับเอกสาร'
        )
        await uploadPdf(
          generated.bondPdf,
          `${receipt.docNo}-แบบข้อมูลตราสารหนี้.pdf`,
          'แบบข้อมูลตราสารหนี้'
        )

        setPdfStatus('saved')
      } catch (error) {
        console.error('Automatic PDF generation error:', error)
        setPdfStatus('error')
      }
    }

    void saveGeneratedPdfs()
  }, [receipt])

  /* ----- การกระทำ ----- */

  const openTemplate = (t: TemplateDef) => {
    const sameTemplate = templateId === t.id

    if (
      !sameTemplate &&
      bond &&
      !window.confirm(
        'เปลี่ยนเทมเพลตจะล้างข้อมูลตราสารหนี้ที่กรอกไว้ ต้องการเปลี่ยนหรือไม่?'
      )
    ) {
      return
    }

    if (!sameTemplate) {
      setTemplateId(t.id)
      setBond(null)
    }

    setDialogInitial(
      sameTemplate && bond ? bond : emptyBondData(t)
    )
  }

  const handleSaveBond = (data: BondData) => {
    setBond(data)
    setDialogInitial(null)
  }

  const resetAll = () => {
    setTemplateId(null)
    setBond(null)
    setDocs({})
    setDialogInitial(null)
    setReceipt(null)
    setPdfStatus('idle')
  }

  const handleCancel = () => {
    if (
      isDirty &&
      !window.confirm('ล้างข้อมูลที่กรอกและไฟล์ที่แนบทั้งหมด?')
    ) {
      return
    }

    resetAll()
  }

  /* ----- ส่งเอกสารและบันทึก Version ----- */
  const handleSubmit = async () => {
    if (!canSubmit || !selected || !bond || submitting) return

    setSubmitting(true)

    try {
      const issuer = fieldValue(bond, 'issuer').trim()
      const symbol = fieldValue(bond, 'symbol').trim()

      if (!issuer || !symbol) {
        throw new Error('กรุณากรอกชื่อบริษัทและสัญลักษณ์ตราสาร')
      }

      const attachments: {
        label: string
        name: string
        size: number
        documentId: string
        version: string
        documentType: string
      }[] = []

      for (const slot of DOC_SLOTS) {
        const file = docs[slot.key]
        if (!file) continue

        const formData = new FormData()

        formData.append('file', file)
        formData.append('issuer', issuer)
        formData.append('symbol', symbol)
        formData.append('documentType', slot.label)
        formData.append('title', `${symbol} — ${issuer}`)

        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()

        if (!response.ok || !result.document?.id) {
          throw new Error(
            result.error || `บันทึก ${slot.label} ไม่สำเร็จ`
          )
        }

        const versions = result.document.versions || []
        const latestVersion = versions[versions.length - 1]

        if (!latestVersion?.version) {
          throw new Error(`ไม่พบ Version ของ ${slot.label}`)
        }

        attachments.push({
          label: slot.label,
          name: file.name,
          size: file.size,
          documentId: result.document.id,
          version: latestVersion.version,
          documentType: slot.label,
        })
      }

      const approvalId = addApproval({
        title: `${symbol} — ${issuer}`,
        issuer,
        symbol,
        bondData: bond,
        docType: selected.name,
        detail: bond.values.nameThai.trim() || undefined,
        files: attachments.map((file) => ({
          name: file.name,
          size: file.size,
          documentId: file.documentId,
          version: file.version,
          documentType: file.documentType,
        })),
      })

      const now = new Date()

      const info: ReceiptInfo = {
        docNo: makeDocNo(now, approvalId),
        issuedAt: now,
        templateName: selected.name,
        submitter: 'ฉัน',
        data: bond,
        attachments: attachments.map(({ label, name, size }) => ({
          label,
          name,
          size,
        })),
      }

      // เก็บสำเนาใบรับเอกสารไว้กับรายการ เพื่อให้ผู้ตรวจกดดูในหน้า Approvals ได้
      attachReceipt(approvalId, {
        ...info,
        issuedAt: info.issuedAt.toISOString(),
      })

      setPdfStatus('idle')
      setReceipt(info)
    } catch (error) {
      console.error('Submit document error:', error)

      window.alert(
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดในการส่งเอกสาร'
      )
    } finally {
      setSubmitting(false)
    }
  }

  /* ===================== หน้าใบรับเอกสาร ===================== */
  if (receipt) {
    return (
      <div className="p-6">
        <div
          role="status"
          className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          ส่งตรวจเอกสารเรียบร้อยแล้ว — เลขที่เอกสาร{' '}
          <b>{receipt.docNo}</b> กดดาวน์โหลดใบรับเอกสารเพื่อเก็บไว้เป็นหลักฐาน
        </div>

        <div
          role="status"
          className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
            pdfStatus === 'saved'
              ? 'border-green-200 bg-green-50 text-green-700'
              : pdfStatus === 'error'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {pdfStatus === 'saving' && 'กำลังสร้างและบันทึก PDF แยก 2 ไฟล์เข้าคลังเอกสาร...'}
          {pdfStatus === 'saved' && 'บันทึก PDF ใบรับเอกสารและแบบข้อมูลตราสารหนี้เข้าคลังเรียบร้อยแล้ว'}
          {pdfStatus === 'error' && 'ส่งเอกสารสำเร็จแล้ว แต่บันทึก PDF อัตโนมัติไม่สำเร็จ คุณยังดาวน์โหลด PDF ด้วยปุ่มเดิมได้'}
          {pdfStatus === 'idle' && 'เตรียมสร้าง PDF อัตโนมัติ...'}
        </div>

        <div className="mx-auto mb-4 flex max-w-3xl flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => router.push('/tracking')}
            className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm text-brand-600 shadow-sm transition hover:bg-brand-50"
          >
            ไปหน้าติดตามสถานะ
          </button>

          <button
            type="button"
            onClick={resetAll}
            className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm text-brand-600 shadow-sm transition hover:bg-brand-50"
          >
            ส่งเอกสารฉบับใหม่
          </button>

          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
            </svg>
            ดาวน์โหลดใบรับเอกสาร (PDF)
          </button>
        </div>

        <div
          ref={receiptElementRef}
          className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
        >
          <ReceiptDocument receipt={receipt} />
        </div>

        {printing && (
          <PrintPortal>
            <ReceiptDocument receipt={receipt} />
          </PrintPortal>
        )}
      </div>
    )
  }

  /* ===================== หน้าฟอร์มส่งตรวจเอกสาร ===================== */
  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-lg font-bold text-slate-900">
          ส่งตรวจเอกสาร / โครงการ
        </h1>
        <p className="mt-0.5 text-xs text-slate-500">
          เลือกเทมเพลต กรอกข้อมูลตราสารหนี้ แนบเอกสารประกอบ แล้วส่งตรวจ
        </p>
      </header>

      {/* ---- แถวเทมเพลต ---- */}
      <section aria-label="เลือกเทมเพลต">
        <h2 className="mb-2 text-sm font-bold text-slate-900">
          เลือกเทมเพลต
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TEMPLATES.map((t) => {
            const isSelected = t.id === templateId
            const filled = isSelected && bond !== null

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => openTemplate(t)}
                aria-pressed={isSelected}
                className={`rounded-xl border-2 bg-white p-4 text-left transition hover:border-orange-300 hover:shadow-sm ${
                  isSelected
                    ? 'border-brand bg-brand-50 ring-2 ring-orange-100'
                    : 'border-slate-200'
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6M8 13h8M8 17h5" />
                  </svg>
                </span>

                <p className="mt-3 text-sm font-bold text-slate-900">
                  {t.name}
                </p>
                <p className="text-xs text-slate-500">{t.subtitle}</p>

                <p
                  className={`mt-3 text-xs font-medium ${
                    filled ? 'text-green-600' : 'text-slate-400'
                  }`}
                >
                  {filled
                    ? '✓ กรอกข้อมูลแล้ว (คลิกเพื่อแก้ไข)'
                    : isSelected
                      ? 'ยังไม่ได้บันทึกข้อมูล'
                      : 'คลิกเพื่อกรอกข้อมูล'}
                </p>
              </button>
            )
          })}
        </div>

        {selected && bond && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm">
            <p className="text-green-800">
              <b>{fieldValue(bond, 'symbol')}</b> ·{' '}
              {fieldValue(bond, 'issuer')} ·{' '}
              {fieldValue(bond, 'issueSize')} ·{' '}
              {fieldValue(bond, 'issueDate')} →{' '}
              {fieldValue(bond, 'maturityDate')}
            </p>

            <button
              type="button"
              onClick={() => openTemplate(selected)}
              className="text-xs font-medium text-green-700 underline"
            >
              แก้ไขข้อมูล
            </button>
          </div>
        )}
      </section>

      {/* ---- กล่องล่าง: ตราสารหนี้ ---- */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-900">ตราสารหนี้</h2>
        <p className="mb-4 mt-0.5 text-xs text-slate-500">
          อัปโหลดเอกสารประกอบการยื่น
        </p>

        <SupportingDocs
          files={docs}
          onChange={(key, file) =>
            setDocs((prev) => ({ ...prev, [key]: file }))
          }
        />

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
          {!canSubmit && (
            <p className="mr-auto text-xs text-slate-400">
              ยังไม่พร้อมส่ง: {missing.join(' · ')}
            </p>
          )}

          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="rounded-lg border border-orange-200 bg-white px-5 py-2 text-sm text-brand-600 shadow-sm transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ยกเลิก
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'กำลังส่ง...' : 'ส่งตรวจเอกสาร'}

            {!submitting && (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </section>

      {/* ---- หน้าต่างกรอกข้อมูลแบบเต็มจอ ---- */}
      {selected && dialogInitial && (
        <BondFormDialog
          key={selected.id}
          template={selected}
          initial={dialogInitial}
          onSave={handleSaveBond}
          onClose={() => setDialogInitial(null)}
        />
      )}
    </div>
  )
}