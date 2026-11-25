/* ดึงข้อมูลตราสารหนี้ 8 ช่องของฟอร์ม "สร้างรายการด้วยเทมเพลต" จากข้อความเอกสาร
   เรียก AI ที่รันในเครื่อง (API แบบ OpenAI-compatible: Ollama / LM Studio ฯลฯ) */

export type BondKey =
  | 'name' | 'symbol' | 'amount' | 'rate'
  | 'target' | 'issueDate' | 'maturityDate' | 'offering'

export const BOND_KEYS: BondKey[] = [
  'name', 'symbol', 'amount', 'rate', 'target', 'issueDate', 'maturityDate', 'offering',
]

const BASE_URL = process.env.LLM_BASE_URL || 'http://localhost:11434/v1'
const MODEL = process.env.LLM_MODEL || 'qwen2.5:14b'
const API_KEY = process.env.LLM_API_KEY || 'local'
const MAX_CHARS = 30000

const SHAPE = {
  name: 'ชื่อตราสารหนี้ภาษาไทยแบบเต็ม เช่น หุ้นกู้ของบริษัท ... ครั้งที่ ... ครบกำหนดไถ่ถอนปี ...',
  symbol: 'ชื่อย่อตราสาร (Symbol) ตัวอักษรอังกฤษ/ตัวเลข ไม่มีช่องว่าง',
  amount: 'วงเงินเสนอขายรวม เป็นจำนวนบาทเต็ม ตัวเลขล้วน เช่น 2500000000 (แปลงจาก "ล้านบาท" ให้เป็นบาทเต็ม)',
  rate: 'อัตราดอกเบี้ยคงที่ต่อปี เป็นตัวเลขเปอร์เซ็นต์ เช่น 3.85',
  target: 'กลุ่มผู้ลงทุนเป้าหมาย (คัดลอกข้อความตามเอกสาร)',
  issueDate: 'วันออกตราสาร รูปแบบ YYYY-MM-DD (ปี ค.ศ.)',
  maturityDate: 'วันครบกำหนดไถ่ถอน รูปแบบ YYYY-MM-DD (ปี ค.ศ.)',
  offering:
    'ประเภทการเสนอขาย เลือกอย่างใดอย่างหนึ่ง: "public" = เสนอขายต่อประชาชนทั่วไป, ' +
    '"ii" = เฉพาะผู้ลงทุนสถาบัน, "iihw" = ผู้ลงทุนสถาบันและผู้ลงทุนรายใหญ่',
}

/* ---------- ทำความสะอาดค่าที่ AI ตอบ (ฟังก์ชันล้วน ทดสอบได้) ---------- */
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

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

function toAmount(v: string): string {
  const n = Number(v.replace(/[^\d.]/g, ''))
  if (!isFinite(n) || n <= 0) return ''
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function toRate(v: string): string {
  const n = parseFloat(v.replace(/[^\d.]/g, ''))
  if (!isFinite(n) || n <= 0 || n > 100) return ''
  return String(n)
}

export function normalize(raw: Record<string, unknown>) {
  const values: Partial<Record<BondKey, string>> = {}

  const put = (k: BondKey, v: string) => { if (v) values[k] = v }
  put('name', str(raw.name))
  put('symbol', str(raw.symbol).toUpperCase().replace(/\s+/g, ''))
  put('amount', toAmount(str(raw.amount)))
  put('rate', toRate(str(raw.rate)))
  put('target', str(raw.target))
  put('issueDate', toIso(str(raw.issueDate)))
  put('maturityDate', toIso(str(raw.maturityDate)))
  const off = str(raw.offering).toLowerCase()
  if (off === 'public' || off === 'ii' || off === 'iihw') values.offering = off

  // วันครบกำหนดต้องอยู่หลังวันออกตราสาร ถ้าไม่ใช่ถือว่าอ่านผิด ให้ผู้ใช้กรอกเอง
  if (values.issueDate && values.maturityDate && values.maturityDate <= values.issueDate) {
    delete values.maturityDate
  }

  const missing = BOND_KEYS.filter((k) => !values[k])
  return { values, missing }
}

/* ---------- เรียก AI ---------- */
export async function extractBond(text: string) {
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
          content: `โครงสร้างที่ต้องการ:\n${JSON.stringify(SHAPE, null, 2)}\n\nเนื้อหาเอกสาร:\n${text.slice(0, MAX_CHARS)}`,
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
