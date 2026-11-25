import { FIELD_GROUPS, displayValue, emptyBondData, formatDateEn, formatNumber } from './bond-config'
import type { BondData, FieldDef } from './bond-config'

/* ตารางข้อมูลตราสารหนี้หน้าตาเหมือนรูปที่ 3 (ป้ายสีเทา / ค่าสีขาว)
   data = null  → แบบฟอร์มเปล่า (ใช้ให้ดาวน์โหลดไปกรอก) */

const labelCell = 'border border-gray-400 bg-gray-200 px-2 py-1.5 text-left align-middle text-[11px] font-semibold text-gray-800'
const valueCell = 'h-7 whitespace-pre-line break-words border border-gray-400 bg-white px-2 py-1.5 align-middle text-[11px] text-gray-900'
const subHead = 'border border-gray-300 bg-gray-50 px-2 py-1 text-left text-[10px] font-medium text-gray-600'
const subCell = 'h-6 whitespace-pre-line break-words border border-gray-300 px-2 py-1 text-[11px] text-gray-900'

// แบ่งช่องเป็นแถวละ 2 ช่อง (ช่องที่เป็น wide ใช้ทั้งแถว)
const chunkPairs = (fields: FieldDef[]): FieldDef[][] => {
  const rows: FieldDef[][] = []
  let pending: FieldDef | null = null

  for (const f of fields) {
    if (f.wide) {
      if (pending) {
        rows.push([pending])
        pending = null
      }
      rows.push([f])
    } else if (pending) {
      rows.push([pending, f])
      pending = null
    } else {
      pending = f
    }
  }
  if (pending) rows.push([pending])

  return rows
}

export default function BondDataSheet({ data }: { data: BondData | null }) {
  const blank = data === null
  const d: BondData = data ?? emptyBondData()

  // แบบฟอร์มเปล่า = ช่องว่าง, มีข้อมูล = ข้อความที่จัดรูปแบบแล้ว
  const text = (def: FieldDef) => (blank ? '' : displayValue(def, d))

  const banner = blank
    ? 'ชื่อตราสาร / Instrument name'
    : `${d.values.symbol || '-'} : ${d.values.nameEnglish || d.values.issuer || '-'}`

  const amortRows = blank ? [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }] : d.amortized

  return (
    <div className="text-gray-900">
      <div className="mb-2 border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-bold">{banner}</div>

      <table className="w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-[18%]" />
          <col className="w-[32%]" />
          <col className="w-[18%]" />
          <col className="w-[32%]" />
        </colgroup>

        <tbody>
          {FIELD_GROUPS.map((group) => {
            /* ---- ป้ายซ้าย/ค่าขวา 2 คู่ต่อแถว ---- */
            if (group.layout === 'pairs') {
              return chunkPairs(group.fields).map((row) => (
                <tr key={row.map((f) => f.key).join('|')} className="break-inside-avoid">
                  {row.length === 1 && row[0].wide ? (
                    <>
                      <th className={labelCell}>{row[0].label}</th>
                      <td colSpan={3} className={valueCell}>
                        {text(row[0])}
                      </td>
                    </>
                  ) : (
                    <>
                      <th className={labelCell}>{row[0].label}</th>
                      <td className={valueCell}>{text(row[0])}</td>
                      {row[1] ? (
                        <>
                          <th className={labelCell}>{row[1].label}</th>
                          <td className={valueCell}>{text(row[1])}</td>
                        </>
                      ) : (
                        <td colSpan={2} className={valueCell} />
                      )}
                    </>
                  )}
                </tr>
              ))
            }

            /* ---- แถวเดียวหลายช่อง (Rating / Coupon) ---- */
            if (group.layout === 'row') {
              return (
                <tr key={group.title} className="break-inside-avoid">
                  <th className={labelCell}>{group.title}</th>
                  <td colSpan={3} className="border border-gray-400 bg-white p-1">
                    <table className="w-full table-fixed border-collapse">
                      <thead>
                        <tr>
                          {group.fields.map((f) => (
                            <th key={f.key} className={subHead}>
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {group.fields.map((f) => (
                            <td key={f.key} className={subCell}>
                              {blank ? '' : text(f)}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              )
            }

            /* ---- Amortized Schedule ---- */
            return (
              <tr key={group.title} className="break-inside-avoid">
                <th className={labelCell}>{group.title}</th>
                <td colSpan={3} className="border border-gray-400 bg-white p-1">
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr>
                        <th className={subHead}>Coupon Date</th>
                        <th className={subHead}>Principal Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {amortRows.length === 0 ? (
                        <tr>
                          <td className={subCell}>-</td>
                          <td className={subCell}>-</td>
                        </tr>
                      ) : (
                        amortRows.map((r) => {
                          const row = r as { id: string; couponDate?: string; principal?: string }
                          return (
                            <tr key={row.id}>
                              <td className={subCell}>
                                {blank ? '' : row.couponDate ? formatDateEn(row.couponDate) : '-'}
                              </td>
                              <td className={subCell}>
                                {blank ? '' : row.principal ? formatNumber(row.principal, 2) : '-'}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}