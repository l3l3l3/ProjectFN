import type { IconName } from "@/components/shared/icon";
import type { Role } from "./session";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}
export interface RoleConfig {
  /** หน้าแรกหลัง login */
  home: string;
  /** path ที่ role นี้เข้าได้ (ตรงตัวหรือขึ้นต้นด้วย path/) */
  allow: string[];
  nav: NavSection[];
}

export const roleConfig: Record<Role, RoleConfig> = {
  // บริษัท / ตัวแทน: ส่งเอกสาร + ติดตามสถานะ
  company: {
    home: "/bonds",
    allow: ["/bonds", "/tracking", "/publish"],
    nav: [
      {
        title: "เอกสารตราสารหนี้",
        items: [
          { href: "/bonds", label: "รายการตราสาร", icon: "folder" },
          { href: "/tracking", label: "ติดตามสถานะ", icon: "clock" },
          { href: "/bonds/submit", label: "ส่งตรวจสอบเอกสาร", icon: "folder" },
          // { href: "/tracking/versions", label: "ประวัติเวอร์ชัน", icon: "clock" },
        ],
      },
    ],
  },
  // เจ้าหน้าที่ตรวจสอบ: ตรวจ/อนุมัติ + ดูประวัติ เท่านั้น
  officer: {
    home: "/approvals",
    // /tracking/versions = หน้าเปรียบเทียบเวอร์ชัน ให้เจ้าหน้าที่เข้าได้ด้วย (ลิงก์เก่าที่ชี้ไป /tracking/versions จะได้ไม่ 404)
    allow: ["/approvals", "/audit-log", "/tracking/versions" , "/bonds",],
    nav: [
      {
        title: "งานตรวจสอบ",
        items: [
          { href: "/bonds", label: "รายการตราสาร", icon: "folder" },
          { href: "/approvals", label: "รอตรวจ / อนุมัติ", icon: "clock" },
          { href: "/approvals/history", label: "ประวัติการส่งเอกสาร", icon: "folder" },
        ],
      },
    ],
  },
  // แอดมิน: จัดการผู้ใช้ + ดูประวัติทั้งระบบ
  admin: {
    home: "/users",
    allow: ["/users", "/roles", "/audit-log", "/dashboard"], // canAccess ให้ admin เข้าได้ทุกหน้าอยู่แล้ว
    nav: [
      {
        title: "ผู้ดูแลระบบ",
        items: [
          { href: "/dashboard", label: "แดชบอร์ด", icon: "layout" },
          { href: "/bonds", label: "รายการตราสาร", icon: "folder" },
          { href: "/users", label: "จัดการผู้ใช้", icon: "gear" },
          { href: "/roles", label: "บทบาทและสิทธิ์", icon: "shield" },         
        ],
      },
      {
        title: "ความปลอดภัยและประวัติ",
        items: [{ href: "/audit-log", label: "Audit Log", icon: "shield" }],
      },
    ],
  },
};

export function canAccess(role: Role, pathname: string) {
  // แอดมินเข้าได้ทุกหน้า
  if (role === "admin") return true;
  return roleConfig[role].allow.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
