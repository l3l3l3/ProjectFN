import type { Session } from "./session";

/**
 * สิทธิ์การมองเห็นเอกสารตามบริษัท (ไฟล์ใหม่ ไม่ได้แก้ระบบเดิม)
 *
 * key   = ชื่อบัญชีที่ล็อกอิน (session.label)
 * value = คำที่ใช้จับคู่กับชื่อ "ผู้ออกตราสาร" (issuer) ของเอกสาร
 *         จับคู่แบบมีคำนี้อยู่ในชื่อ ไม่สนตัวพิมพ์เล็ก/ใหญ่
 *
 * ตัวอย่างด้านล่างเป็นข้อมูลสมมติ แก้เป็นชื่อบริษัทจริงตามที่กรอกในช่อง "ผู้ออกตราสาร"
 * เจ้าหน้าที่ตรวจสอบ (officer) เห็นทุกบริษัทเสมอ ไม่ต้องระบุที่นี่
 */
export const COMPANY_ACCESS: Record<string, string[]> = {
  "บริษัท aaa": ["aaa"],
  "บริษัท bbb": ["bbb"],
  "บริษัท ccc": ["ccc"],
  // ตัวแทน/อันเดอร์ไรเตอร์ ส่งแทนได้เฉพาะบริษัทที่ระบุไว้
  "ตัวแทนบริษัท": ["aaa", "bbb"],
};

/** "all" = เห็นทุกบริษัท, อาร์เรย์ = เห็นเฉพาะบริษัทที่จับคู่ได้ */
export function allowedCompanies(session: Session): string[] | "all" {
  if (session.role === "officer" || session.role === "admin") return "all";
  return COMPANY_ACCESS[session.label] ?? [];
}

export function matchesCompany(issuer: string | undefined, allowed: string[]): boolean {
  if (!issuer) return false;
  const name = issuer.trim().toLowerCase();
  return allowed.some((a) => a.trim() !== "" && name.includes(a.trim().toLowerCase()));
}
