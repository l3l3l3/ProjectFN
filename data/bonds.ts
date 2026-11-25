export type BondStatus = "complete" | "pending" | "draft";

export interface Bond {
  id: string;
  code: string;
  symbol: string;
  type: string;
  template: string;
  version: string;
  status: BondStatus;
  issuer: string;
  amount: string;
  rate: string;
  createdAt: string;
  editor: string;
}

const REOPEN = "Reopen (รายการย่อย)";
const USE_MAIN = "ใช้ของตราสารหลัก";
const NEW_TPL = "เลือก Template ใหม่";

type Row = [string, string, string, string, BondStatus];
// [type, template, version, symbol, status]
const rows: Row[] = [
  ["ตราสารหลัก", "[Template A] v2", "[Template A] v2.4", "CPALL256A", "complete"],
  [REOPEN, USE_MAIN, "[Template A] v2.1", "PTT278B", "pending"],
  [REOPEN, NEW_TPL, "[Template A] v2", "PTT278B", "draft"],
  [REOPEN, USE_MAIN, "[Template B] v1", "PTT278B", "complete"],
  [REOPEN, USE_MAIN, "[Template A] v1.8", "PTT278B", "complete"],
  [REOPEN, NEW_TPL, "[Template A] v2", "PTT278B", "pending"],
  [REOPEN, USE_MAIN, "[Template A] v2", "PTT278B", "complete"],
  [REOPEN, NEW_TPL, "[Template A] v2", "PTT278B", "complete"],
  [REOPEN, NEW_TPL, "[Template A] v2", "PTT278B", "complete"],
  [REOPEN, USE_MAIN, "[Template A] v2", "PTT278B", "complete"],
  [REOPEN, USE_MAIN, "[Template A] v2", "PTT278B", "complete"],
  [REOPEN, NEW_TPL, "[Template A] v2", "PTT278B", "complete"],
];

export const bonds: Bond[] = rows.map(([type, template, version, symbol, status], i) => ({
  id: String(i + 1),
  code: `[รหัสตราสาร ${i + 1}]`,
  symbol,
  type,
  template,
  version,
  status,
  issuer: "หุ้นกู้บริษัท ซีพี ออลล์ จำกัด (มหาชน)",
  amount: "5,000 ล้านบาท",
  rate: "3.45%",
  createdAt: "14 ต.ค. 2568, 10:30 น.",
  editor: "อัญชลี ศิริวัฒน์ (Senior Legal)",
}));

export const statusLabel: Record<BondStatus, string> = {
  complete: "สมบูรณ์แล้ว",
  pending: "รอตรวจ",
  draft: "ร่าง (Draft)",
};

/* ---------- รอตรวจ / อนุมัติ ---------- */
export interface Approval {
  id: string;
  code: string;
  name: string;
  type: string;
  template: string;
  version: string;
  updatedAt: string;
  templateRef: string;
}

const approvalRows: [string, string, string][] = [
  ["ตราสารหลัก", "[Template A] v2", "ตราสารหลัก"],
  ["MTN (รายการย่อย)", USE_MAIN, "MTN (รายการย่อย)"],
  [REOPEN, NEW_TPL, REOPEN],
  ...Array.from({ length: 11 }, (): [string, string, string] => [REOPEN, USE_MAIN, REOPEN]),
];

export const approvals: Approval[] = approvalRows.map(([type, template], i) => ({
  id: String(i + 1),
  code: `[รหัสตราสาร ${i + 1}]`,
  name: `หุ้นกู้ระยะสั้น ${type.startsWith("MTN") ? "MTN " : ""}(รายการย่อยชุดที่ ${i + 1})`,
  type,
  template,
  version: "[Template A] v2",
  updatedAt: `${String(15 - Math.min(i, 14)).padStart(2, "0")} พ.ย. 2569`,
  templateRef: `MTN-TH-2024-${String.fromCharCode(88 + (i % 3))}`,
}));
