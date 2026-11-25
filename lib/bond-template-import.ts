/* ดึงข้อมูลตามฟอร์มจริงของหน้า "ส่งตรวจเอกสาร" (bond-config.ts) จากข้อความเอกสาร Word
   key / ชนิดช่อง / ตัวเลือกของ dropdown อ่านจาก FIELD_GROUPS โดยตรง จึงตรงกับฟอร์มเสมอ
   เรียก AI ที่รันในเครื่อง (OpenAI-compatible: Ollama / LM Studio) */

// ปรับ path ให้ตรงกับที่ bond-config.ts อยู่จริง
import { FIELD_GROUPS } from '../app/(app)/(company)/bonds/submit/bond-config'
import type { FieldDef } from '../app/(app)/(company)/bonds/submit/bond-config'

const BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1'
const MODEL = process.env.LLM_MODEL || 'qwen2.5:14b'
const API_KEY = process.env.LLM_API_KEY || 'local'
const MAX_CHARS = 30000

/* ช่องที่ให้ AI ดึง + คำอธิบาย (ช่องที่ไม่อยู่ในนี้ผู้ใช้กรอกเอง เช่น อันดับเครดิต ตารางทยอยจ่ายคืนเงินต้น) */
const HINTS: Record<string, string> = {
  symbol: 'ชื่อย่อตราสาร (Symbol) ตัวอักษรอังกฤษ/ตัวเลข ไม่มีช่องว่าง เช่น ASW26DA',
  registrationDate: 'วันที่จดทะเบียนตราสาร รูปแบบ YYYY-MM-DD (ปี ค.ศ.)',
  issuer: 'ชื่อผู้ออกตราสารเป็นภาษาอังกฤษ',
  nameThai: 'ชื่อตราสารภาษาไทยแบบเต็ม เช่น หุ้นกู้ของบริษัท ... ครั้งที่ ... ครบกำหนดไถ่ถอนปี ...',
  nameEnglish: 'ชื่อตราสารภาษาอังกฤษแบบเต็ม',
  isinLocal: 'รหัส ISIN ในประเทศ (ขึ้นต้น TH)',
  isinForeign: 'รหัส ISIN ต่างประเทศ',
  collateral: 'หลักประกัน ถ้าไม่มีหลักประกันให้ใส่ "-"',
  putCall: 'สิทธิขายคืน/เรียกไถ่ถอน',
  bondType: 'ประเภทตราสาร',
  paymentFrequency: 'ความถี่ในการจ่ายดอกเบี้ย',
  calculationMethod: 'วิธีคำนวณดอกเบี้ย',
  initialPar: 'มูลค่าที่ตราไว้ต่อหน่วยเป็นบาท ตัวเลขล้วน เช่น 1000',
  currentPar: 'มูลค่าที่ตราไว้ปัจจุบันต่อหน่วยเป็นบาท ตัวเลขล้วน',
  issueSize: 'มูลค่าที่ออกรวมเป็นบาทเต็ม ตัวเลขล้วน เช่น 2500000000 (แปลงจาก "ล้านบาท" เป็นบาทเต็ม)',
  outstandingSize: 'มูลค่าคงค้างเป็นบาทเต็ม ตัวเลขล้วน',
  issueDate: 'วันออกตราสาร รูปแบบ YYYY-MM-DD (ปี ค.ศ.)',
  maturityDate: 'วันครบกำหนดไถ่ถอน รูปแบบ YYYY-MM-DD (ปี ค.ศ.)',
  distribution: 'ประเภทผู้ลงทุนเป้าหมาย เป็นภาษาอังกฤษ เช่น Institutional Investors or High Net Worth Investors',
  couponReference: 'อัตราดอกเบี้ย เช่น "Fixed: 5.4%"',
  registrar: 'นายทะเบียนหุ้นกู้',
  debentureRep: 'ผู้แทนผู้ถือหุ้นกู้',
  underwriters: 'รายชื่อผู้จัดจำหน่าย หนึ่งรายชื่อต่อหนึ่งบรรทัด (คั่นด้วย \\n)',
  financialAdvisors: 'รายชื่อที่ปรึกษาทางการเงิน หนึ่งรายชื่อต่อหนึ่งบรรทัด (คั่นด้วย \\n)',
}

// ช่องที่ฟอร์มเก็บเป็น "ล้านบาท" (AI ตอบเป็นบาทเต็ม แล้วหารให้ที่นี่)
const MLN_KEYS = new Set(['issueSize', 'outstandingSize'])

const FIELDS = new Map<string, FieldDef>(
  FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f])
)
export const TEMPLATE_KEYS = Object.keys(HINTS).filter((k) => FIELDS.has(k))

/* ---------- สร้างโครงสร้างที่ส่งให้ AI ---------- */
function buildShape(): Record<string, string> {
  const shape: Record<string, string> = {}
  for (const k of TEMPLATE_KEYS) {
    const def = FIELDS.get(k)!
    shape[k] =
      def.type === 'select' && def.options
        ? `${HINTS[k]} เลือกอย่างใดอย่างหนึ่งตามนี้เท่านั้น: ${def.options.map((o) => `"${o}"`).join(', ')}`
        : HINTS[k]
  }
  return shape
}

/* ---------- ทำความสะอาดค่าที่ AI ตอบ (ฟังก์ชันล้วน) ---------- */
const str = (v: unknown) =>
  v === null || v === undefined ? '' : Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).join('\n') : String(v).trim()

function toIso(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  let y = +m[1]
  if (y > 2400) y -= 543 // กันกรณี AI ตอบเป็น พ.ศ.
  const mo = +m[2], d = +m[3]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${m[2]}-${m[3]}`
}

function toNumber(v: string): number | null {
  const n = Number(v.replace(/[^\d.]/g, ''))
  return isFinite(n) && n > 0 ? n : null
}

export function normalize(raw: Record<string, unknown>) {
  const values: Record<string, string> = {}

  for (const key of TEMPLATE_KEYS) {
    const def = FIELDS.get(key)!
    const v = str(raw[key])
    if (!v) continue

    let out = ''
    if (def.type === 'date') {
      out = toIso(v)
    } else if (def.type === 'number') {
      const n = toNumber(v)
      if (n !== null) out = MLN_KEYS.has(key) ? (n / 1_000_000).toFixed(2) : String(n)
    } else if (def.type === 'select') {
      out = def.options?.find((o) => o.toLowerCase() === v.toLowerCase()) ?? ''
    } else if (key === 'symbol') {
      out = v.toUpperCase().replace(/\s+/g, '')
    } else {
      out = v
    }
    if (out) values[key] = out
  }

  // วันครบกำหนดต้องอยู่หลังวันออกตราสาร ถ้าไม่ใช่ถือว่าอ่านผิด ให้ผู้ใช้กรอกเอง
  if (values.issueDate && values.maturityDate && values.maturityDate <= values.issueDate) {
    delete values.maturityDate
  }

  const missing = TEMPLATE_KEYS.filter((k) => !values[k])
  return { values, missing }
}

/* ---------- เรียก AI ---------- */
export async function extractBondTemplate(text: string) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content:
            'สกัดข้อมูลหุ้นกู้/ตราสารหนี้จากเอกสาร ตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น ' +
            'ใช้เฉพาะ key ตามโครงสร้างที่กำหนด (ค่าในตัวอย่างคือคำอธิบายช่อง) ' +
            'ถ้าไม่พบข้อมูลช่องใดให้ใส่ null ห้ามเดาหรือแต่งข้อมูลเอง คัดลอกชื่อและรหัสให้ตรงกับเอกสาร',
        },
        {
          role: 'user',
          content: `โครงสร้างที่ต้องการ:\n${JSON.stringify(buildShape(), null, 2)}\n\nเนื้อหาเอกสาร:\n${text.slice(0, MAX_CHARS)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(5 * 60 * 1000),
  }).catch(() => {
    throw new Error(`เชื่อมต่อ AI ที่ ${BASE_URL} ไม่ได้ (เปิด Ollama/LM Studio อยู่หรือเปล่า)`)
  })

  if (!res.ok) throw new Error(`AI ตอบกลับผิดพลาด (${res.status})`)
  const content: string = (await res.json()).choices?.[0]?.message?.content ?? ''
  const match = content.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('AI ตอบกลับในรูปแบบที่อ่านไม่ได้ ลองใช้โมเดลที่ใหญ่ขึ้น')

  try {
    return normalize(JSON.parse(match[0]))
  } catch {
    throw new Error('AI ตอบกลับเป็น JSON ไม่สมบูรณ์ (อาจโดนตัดเพราะ context เล็กเกินไป)')
  }
}
