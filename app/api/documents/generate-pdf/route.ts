import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

export const maxDuration = 120

const MAX_HTML_LENGTH = 2_000_000

function isLocalOrigin(value: unknown): value is string {
  if (typeof value !== 'string') return false

  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null

  try {
    const body = await request.json()
    const { origin, stylesheets, inlineStyles, receiptHtml, bondHtml } = body ?? {}

    if (!isLocalOrigin(origin)) {
      return NextResponse.json(
        { error: 'ที่อยู่เว็บไซต์ไม่ถูกต้อง กรุณาเปิดระบบผ่าน localhost' },
        { status: 400 }
      )
    }

    if (
      typeof receiptHtml !== 'string' ||
      typeof bondHtml !== 'string' ||
      receiptHtml.length > MAX_HTML_LENGTH ||
      bondHtml.length > MAX_HTML_LENGTH
    ) {
      return NextResponse.json(
        { error: 'ข้อมูลเอกสารไม่ถูกต้องหรือมีขนาดใหญ่เกินไป' },
        { status: 400 }
      )
    }

    const safeStylesheets = Array.isArray(stylesheets)
      ? stylesheets.filter((href: unknown): href is string => {
          if (typeof href !== 'string') return false
          try {
            return new URL(href).origin === origin
          } catch {
            return false
          }
        })
      : []

    const safeInlineStyles = Array.isArray(inlineStyles)
      ? inlineStyles.filter(
          (style: unknown): style is string =>
            typeof style === 'string' && style.length <= 500_000
        )
      : []

    const head = `
      <meta charset="utf-8" />
      <base href="${origin}/" />
      ${safeStylesheets.map((href: string) => `<link rel="stylesheet" href="${href}" />`).join('\n')}
      ${safeInlineStyles.map((style: string) => `<style>${style}</style>`).join('\n')}
      <style>
        @page { size: A4; margin: 12mm; }
        html { background: #fff; }
        body { margin: 0; padding: 0; background: #fff; }
        main { width: 100%; color: #111827; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      </style>
    `

    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1600 },
      deviceScaleFactor: 1,
    })

    // เปิด origin ก่อน เพื่อให้ stylesheet ที่เป็น path ภายในเว็บโหลดจาก origin เดียวกัน
    await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    const createPdf = async (html: string) => {
      await page.setContent(
        `<!doctype html><html lang="th"><head>${head}</head><body><main>${html}</main></body></html>`,
        { waitUntil: 'networkidle', timeout: 45_000 }
      )
      await page.evaluate(() => document.fonts.ready)
      return page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '12mm',
          right: '12mm',
          bottom: '12mm',
          left: '12mm',
        },
      })
    }

    const receiptPdf = await createPdf(receiptHtml)
    const bondPdf = await createPdf(bondHtml)

    return NextResponse.json({
      success: true,
      receiptPdf: receiptPdf.toString('base64'),
      bondPdf: bondPdf.toString('base64'),
    })
  } catch (error) {
    console.error('Generate PDF error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `สร้าง PDF ไม่สำเร็จ: ${error.message}`
            : 'เกิดข้อผิดพลาดในการสร้าง PDF',
      },
      { status: 500 }
    )
  } finally {
    if (browser) await browser.close().catch(() => undefined)
  }
}
