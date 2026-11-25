/* =====================================================================
   ตั้งค่าแบบฟอร์มข้อมูลตราสารหนี้ (อิงตามรูปที่ 3) + เทมเพลต + ฟังก์ชันช่วย
   แก้รายการช่องกรอก / เทมเพลต ได้ที่ไฟล์นี้ที่เดียว
   ===================================================================== */

/* ---------- ชนิดข้อมูล ---------- */
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'computed'

export type FieldDef = {
  key: string
  label: string
  labelTh?: string      // คำแปลภาษาไทย แสดงในวงเล็บต่อท้ายชื่อภาษาอังกฤษ (เฉพาะในฟอร์มกรอกข้อมูล)
  type?: FieldType      // ไม่ระบุ = text
  required?: boolean
  options?: string[]    // ใช้กับ select
  placeholder?: string
  hint?: string
  wide?: boolean        // กินเต็มแถว (ใช้ในกลุ่ม pairs)
  // ใช้ตอนแสดงผลตัวเลขในเอกสาร เช่น prefix "THB " + suffix " mln."
  prefix?: string
  suffix?: string
  decimals?: number
}

export type FieldGroup = {
  title: string
  titleTh?: string      // คำแปลภาษาไทยของหัวข้อกลุ่ม
  // pairs = ป้ายซ้าย/ช่องขวา 2 คู่ต่อแถว, row = แถวเดียวหลายช่อง, amortized = ตารางเพิ่มแถวได้
  layout: 'pairs' | 'row' | 'amortized'
  fields: FieldDef[]
}

export type AmortRow = { id: string; couponDate: string; principal: string }
export type BondValues = Record<string, string>
export type BondData = { values: BondValues; amortized: AmortRow[] }

export type TemplateDef = {
  id: string
  name: string
  subtitle: string
  defaults: BondValues // ค่าที่เทมเพลตกรอกไว้ให้ล่วงหน้า
}

/* ---------- ตัวเลือกของ dropdown ---------- */
const BOND_TYPES = [
  'Senior, Unsecured',
  'Senior, Secured',
  'Subordinated, Unsecured',
  'Subordinated, Secured',
  'Unsecured',
  'Secured',
]
const PAYMENT_FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'At Maturity']
const CALCULATION_METHODS = ['30/360', 'Actual/365', 'Actual/360', 'Actual/Actual']
const PUT_CALL = ['-', 'Put', 'Call', 'Put/Call']

/* ---------- กลุ่มช่องกรอก (เรียงตามรูปที่ 3) ---------- */
export const FIELD_GROUPS: FieldGroup[] = [
  {
    title: 'General',
    titleTh: 'ข้อมูลทั่วไป',
    layout: 'pairs',
    fields: [
      { key: 'symbol', label: 'Symbol', labelTh: 'สัญลักษณ์ตราสาร', required: true, placeholder: 'เช่น ASW26DA' },
      { key: 'registrationDate', label: 'Registration Date', labelTh: 'วันที่จดทะเบียน', type: 'date' },
      { key: 'issuer', label: 'Issuer', labelTh: 'ผู้ออกตราสาร', required: true, placeholder: 'ชื่อผู้ออกตราสาร (ภาษาอังกฤษ)' },
      { key: 'nameThai', label: 'Name (Thai)', labelTh: 'ชื่อภาษาไทย', placeholder: 'ชื่อตราสาร (ภาษาไทย)' },
      { key: 'nameEnglish', label: 'Name (English)', labelTh: 'ชื่อภาษาอังกฤษ', wide: true, placeholder: 'เช่น HIGH RISK DEBENTURES OF ... NO.3/2024 Tranche 1 DUE 2026' },
      { key: 'isinLocal', label: 'ISIN Code (Local)', labelTh: 'รหัส ISIN ในประเทศ' },
      { key: 'putCall', label: 'Put/ Call Option', labelTh: 'สิทธิในการขายคืน/เรียกไถ่ถอน', type: 'select', options: PUT_CALL },
      { key: 'isinForeign', label: 'ISIN Code (Foreign)', labelTh: 'รหัส ISIN ต่างประเทศ' },
      { key: 'collateral', label: 'Collateral', labelTh: 'หลักประกัน' },
      { key: 'bondType', label: 'Bond Type', labelTh: 'ประเภทตราสาร', type: 'select', options: BOND_TYPES },
      { key: 'paymentFrequency', label: 'Payment Frequency', labelTh: 'ความถี่ในการจ่ายดอกเบี้ย', type: 'select', options: PAYMENT_FREQUENCIES },
      { key: 'initialPar', label: 'Initial Par (THB)', labelTh: 'มูลค่าที่ตราไว้เริ่มต้น', type: 'number', prefix: 'THB ', decimals: 4, placeholder: '1000' },
      { key: 'calculationMethod', label: 'Calculation Method', labelTh: 'วิธีคำนวณดอกเบี้ย', type: 'select', options: CALCULATION_METHODS },
      { key: 'currentPar', label: 'Current Par (THB)', labelTh: 'มูลค่าที่ตราไว้ปัจจุบัน', type: 'number', prefix: 'THB ', decimals: 4, placeholder: '1000' },
      { key: 'issueTerm', label: 'Issue Term / TTM', labelTh: 'อายุตราสาร / อายุคงเหลือ', type: 'computed', hint: 'คำนวณอัตโนมัติจากวันที่ออกและวันครบกำหนด' },
      { key: 'issueSize', label: 'Issue Size (THB mln.)', labelTh: 'มูลค่าที่ออก', type: 'number', required: true, prefix: 'THB ', suffix: ' mln.', decimals: 2, placeholder: '274.90' },
      { key: 'issueDate', label: 'Issue Date', labelTh: 'วันที่ออกตราสาร', type: 'date', required: true },
      { key: 'outstandingSize', label: 'Outstanding Size (THB mln.)', labelTh: 'มูลค่าคงค้าง', type: 'number', prefix: 'THB ', suffix: ' mln.', decimals: 2, placeholder: '274.90' },
      { key: 'maturityDate', label: 'Maturity Date', labelTh: 'วันครบกำหนด', type: 'date', required: true },
      { key: 'distribution', label: 'Distribution', labelTh: 'การจัดจำหน่าย', placeholder: 'เช่น Institutional Investors or High Net Worth Investors' },
      { key: 'prospectus', label: 'Prospectus', labelTh: 'หนังสือชี้ชวน', placeholder: 'ลิงก์หรือหมายเหตุ' },
      { key: 'indexRatio', label: 'Index Ratio', labelTh: 'อัตราส่วนดัชนี' },
      { key: 'esgReport', label: 'External Review Report (ESG)', labelTh: 'รายงานการประเมินภายนอก ESG' },
    ],
  },
  {
    title: 'Issue Rating',
    titleTh: 'อันดับความน่าเชื่อถือของตราสาร',
    layout: 'row',
    fields: [
      { key: 'issueRatingAgency', label: 'Rating Agency', labelTh: 'สถาบันจัดอันดับ' },
      { key: 'issueRating', label: 'Issue Rating', labelTh: 'อันดับตราสาร' },
      { key: 'issueRatingDate', label: 'Rating Date', labelTh: 'วันที่จัดอันดับ', type: 'date' },
    ],
  },
  {
    title: 'Issuer Rating',
    titleTh: 'อันดับความน่าเชื่อถือของผู้ออก',
    layout: 'row',
    fields: [
      { key: 'issuerRatingName', label: 'Issuer Name', labelTh: 'ชื่อผู้ออก' },
      { key: 'issuerRatingAgency', label: 'Rating Agency', labelTh: 'สถาบันจัดอันดับ' },
      { key: 'issuerRating', label: 'Issuer Rating', labelTh: 'อันดับผู้ออก' },
      { key: 'issuerRatingDate', label: 'Rating Date', labelTh: 'วันที่จัดอันดับ', type: 'date' },
    ],
  },
  {
    title: 'Guarantor Rating',
    titleTh: 'อันดับความน่าเชื่อถือของผู้ค้ำประกัน',
    layout: 'row',
    fields: [
      { key: 'guarantorName', label: 'Guarantor Name', labelTh: 'ชื่อผู้ค้ำประกัน' },
      { key: 'guarantorRatingAgency', label: 'Rating Agency', labelTh: 'สถาบันจัดอันดับ' },
      { key: 'guarantorRating', label: 'Guarantor Rating', labelTh: 'อันดับผู้ค้ำประกัน' },
      { key: 'guarantorRatingDate', label: 'Rating Date', labelTh: 'วันที่จัดอันดับ', type: 'date' },
    ],
  },
  {
    title: 'Coupon Payment',
    titleTh: 'การจ่ายดอกเบี้ย',
    layout: 'row',
    fields: [
      { key: 'couponReference', label: 'Reference', labelTh: 'อัตราอ้างอิง', placeholder: 'เช่น Fixed: 5.4%' },
      { key: 'couponMax', label: 'Max.', labelTh: 'สูงสุด' },
      { key: 'couponMin', label: 'Min.', labelTh: 'ต่ำสุด' },
      { key: 'couponFrom', label: 'From', labelTh: 'ตั้งแต่', type: 'date' },
      { key: 'couponTo', label: 'To', labelTh: 'ถึง', type: 'date' },
    ],
  },
  { title: 'Amortized Schedule', titleTh: 'ตารางการทยอยจ่ายคืนเงินต้น', layout: 'amortized', fields: [] },
  {
    title: 'Parties',
    titleTh: 'ผู้เกี่ยวข้อง',
    layout: 'pairs',
    fields: [
      { key: 'registrar', label: 'Registrar', labelTh: 'นายทะเบียนตราสาร', wide: true },
      { key: 'debentureRep', label: 'Debenture Holder Representatives', labelTh: 'ผู้แทนผู้ถือหุ้นกู้', wide: true },
      { key: 'underwriters', label: 'Underwriter(s)', labelTh: 'ผู้จัดจำหน่าย', type: 'textarea', wide: true, hint: 'พิมพ์หนึ่งรายชื่อต่อหนึ่งบรรทัด' },
      { key: 'financialAdvisors', label: 'Financial Advisor(s)', labelTh: 'ที่ปรึกษาทางการเงิน', type: 'textarea', wide: true, hint: 'พิมพ์หนึ่งรายชื่อต่อหนึ่งบรรทัด' },
      { key: 'remark', label: 'Remark', labelTh: 'หมายเหตุ', type: 'textarea', wide: true },
    ],
  },
]

const allFields = (): FieldDef[] => FIELD_GROUPS.flatMap((g) => g.fields)

// ลำดับ key ของช่องกรอกทั้งหมดตามลำดับในฟอร์ม (ไม่รวมช่องที่คำนวณเอง)
export const FIELD_KEYS: string[] = allFields()
  .filter((f) => f.type !== 'computed')
  .map((f) => f.key)

/* ---------- เทมเพลต (ชื่อเป็นตัวอย่าง แก้ได้) ---------- */
const COMMON = {
  putCall: '-',
  distribution: 'Institutional Investors or High Net Worth Investors',
  esgReport: 'Not Available',
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'senior',
    name: 'หุ้นกู้ไม่ด้อยสิทธิ',
    subtitle: 'Senior Unsecured Debenture',
    defaults: { ...COMMON, bondType: 'Senior, Unsecured', paymentFrequency: 'Quarterly', calculationMethod: '30/360', collateral: '-' },
  },
  {
    id: 'subordinated',
    name: 'หุ้นกู้ด้อยสิทธิ',
    subtitle: 'Subordinated Debenture',
    defaults: { ...COMMON, bondType: 'Subordinated, Unsecured', paymentFrequency: 'Semi-annual', calculationMethod: '30/360', collateral: '-', putCall: 'Call' },
  },
  {
    id: 'secured',
    name: 'หุ้นกู้มีหลักประกัน',
    subtitle: 'Secured Debenture',
    defaults: { ...COMMON, bondType: 'Senior, Secured', paymentFrequency: 'Quarterly', calculationMethod: '30/360' },
  },
  {
    id: 'bill',
    name: 'ตั๋วเงิน / ตราสารระยะสั้น',
    subtitle: 'Bill of Exchange / Short-term',
    defaults: { ...COMMON, bondType: 'Unsecured', paymentFrequency: 'At Maturity', calculationMethod: 'Actual/365', collateral: '-', distribution: 'Institutional Investors' },
  },
]

/* ---------- สร้างข้อมูลเริ่มต้น / ตรวจความถูกต้อง ---------- */
export const emptyBondData = (template?: TemplateDef | null): BondData => ({
  values: {
    ...Object.fromEntries(FIELD_KEYS.map((k) => [k, ''])),
    ...(template?.defaults ?? {}),
  },
  amortized: [],
})

// คืนข้อความผิดพลาดของแต่ละช่อง (ถ้าไม่มี key นั้น = ช่องนั้นถูกต้อง)
export const validateBond = (data: BondData): Record<string, string> => {
  const errors: Record<string, string> = {}

  for (const f of allFields()) {
    if (f.required && (data.values[f.key] ?? '').trim() === '') {
      errors[f.key] = 'กรุณากรอกข้อมูล'
    }
  }

  const { issueDate, maturityDate } = data.values
  // วันที่ในรูป YYYY-MM-DD เทียบเป็นข้อความได้เลย
  if (issueDate && maturityDate && maturityDate <= issueDate && !errors.maturityDate) {
    errors.maturityDate = 'วันครบกำหนดต้องอยู่หลังวันที่ออกตราสาร'
  }

  return errors
}

/* ---------- ฟังก์ชันจัดรูปแบบ ---------- */
const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000

// "2.00 Yrs./0.13 Yrs." = อายุตราสาร / อายุคงเหลือ
export const computeTerm = (issueDate: string, maturityDate: string, today: Date = new Date()): string => {
  if (!issueDate || !maturityDate) return '-'
  const issue = new Date(issueDate).getTime()
  const maturity = new Date(maturityDate).getTime()
  if (Number.isNaN(issue) || Number.isNaN(maturity) || maturity <= issue) return '-'

  const term = (maturity - issue) / YEAR_MS
  const ttm = Math.max(0, (maturity - today.getTime()) / YEAR_MS)
  return `${term.toFixed(2)} Yrs./${ttm.toFixed(2)} Yrs.`
}

export const formatNumber = (raw: string, decimals = 2): string => {
  const n = Number(raw)
  if (raw.trim() === '' || Number.isNaN(n)) return raw
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// 2024-12-19 -> "19 December 2024"
export const formatDateEn = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// 2516582 -> "2.4 MB"
export const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

// ข้อความที่จะแสดงในเอกสารสำหรับช่องหนึ่ง ๆ
export const displayValue = (def: FieldDef, data: BondData): string => {
  if (def.type === 'computed') return computeTerm(data.values.issueDate, data.values.maturityDate)

  const raw = (data.values[def.key] ?? '').trim()
  if (raw === '') return '-'
  if (def.type === 'number') return `${def.prefix ?? ''}${formatNumber(raw, def.decimals ?? 2)}${def.suffix ?? ''}`
  if (def.type === 'date') return formatDateEn(raw)
  return raw
}

// ดึงข้อความของช่องจาก key (ใช้ในใบรับเอกสาร)
export const fieldValue = (data: BondData, key: string): string => {
  const def = allFields().find((f) => f.key === key)
  return def ? displayValue(def, data) : '-'
}

/* ---------- ตัวช่วยอื่น ๆ ---------- */
export const makeRowId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36)

// เลขที่เอกสาร เช่น DOC-20261107-0026
export const makeDocNo = (date: Date, seq: number): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `DOC-${y}${m}${d}-${String(seq).padStart(4, '0')}`
}