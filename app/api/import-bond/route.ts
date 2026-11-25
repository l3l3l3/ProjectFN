import { docxToText } from '@/lib/docx-text'
import { extractBond } from '@/lib/bond-import'
import { extractBondTemplate } from '@/lib/bond-template-import'


const MAX_MB = 4

export async function POST(req: Request) {
  try {
    // เช็กขนาดจาก header ก่อน จะได้ไม่ต้องอ่านไฟล์ใหญ่เข้า memory
    const len = Number(req.headers.get('content-length') ?? 0)
    if (len > (MAX_MB + 1) * 1024 * 1024) {
      return Response.json({ error: `ไฟล์มีขนาดเกิน ${MAX_MB} MB` }, { status: 413 })
    }

    const form = await req.formData()
    const file = form.get('file')
    // mode=form → ดึงตามฟอร์มของหน้าส่งตรวจเอกสาร (bond-config), ไม่ส่ง → แบบ 8 ช่องเดิมของ create-from-template
    const mode = form.get('mode')

    if (!(file instanceof File)) return Response.json({ error: 'ไม่พบไฟล์' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.docx')) {
      return Response.json({ error: 'รองรับเฉพาะไฟล์ Word (.docx)' }, { status: 400 })
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      return Response.json({ error: `ไฟล์มีขนาดเกิน ${MAX_MB} MB` }, { status: 400 })
    }

    let text: string
    try {
      text = await docxToText(Buffer.from(await file.arrayBuffer()))
    } catch {
      return Response.json({ error: 'อ่านไฟล์ Word ไม่ได้ (ไฟล์อาจเสียหรือไม่ใช่ .docx จริง)' }, { status: 422 })
    }
    if (text.length < 20) {
      return Response.json({ error: 'ไม่พบข้อความในไฟล์ (อาจเป็นไฟล์ที่เป็นรูปภาพล้วน)' }, { status: 422 })
    }

    return Response.json(mode === 'form' ? await extractBondTemplate(text) : await extractBond(text))
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'เกิดข้อผิดพลาด' }, { status: 500 })
  }
}
