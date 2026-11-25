'use client'
import React, { useMemo, useState } from 'react';

type RoleKey = 'submitter' | 'reviewer' | 'admin';
type PermKey = 'submit' | 'view_docs' | 'review' | 'view_audit' | 'manage_users';

interface Employee {
  id: number;
  name: string;
  email: string;
  organization: string;
  roles: RoleKey[];
  active: boolean;
}

interface RoleInfo {
  key: RoleKey;
  label: string;
  desc: string;
  badge: string;
  perms: PermKey[];
}

// สิทธิ์ที่ระบบมี
const PERMISSIONS: { key: PermKey; label: string }[] = [
  { key: 'submit', label: 'ส่งเอกสาร' },
  { key: 'view_docs', label: 'ดูเอกสาร' },
  { key: 'review', label: 'อนุมัติ / รีเจคเอกสาร' },
  { key: 'view_audit', label: 'ดู Audit Log' },
  { key: 'manage_users', label: 'จัดการผู้ใช้และบทบาท' },
];

// บทบาททั้งหมด และสิทธิ์ที่แต่ละบทบาทได้รับ
const ROLES: RoleInfo[] = [
  { key: 'submitter', label: 'บริษัทผู้ส่งเอกสาร', desc: 'ส่งเอกสารตราสารหนี้เข้าระบบและติดตามสถานะ', badge: 'bg-sky-50 text-sky-800 border-sky-200', perms: ['submit', 'view_docs'] },
  { key: 'reviewer', label: 'เจ้าหน้าที่ตรวจสอบ', desc: 'ตรวจเอกสาร อนุมัติหรือรีเจค และดูประวัติการดำเนินการ', badge: 'bg-orange-50 text-orange-700 border-orange-200', perms: ['view_docs', 'review', 'view_audit'] },
  { key: 'admin', label: 'ผู้ดูแลระบบ', desc: 'จัดการผู้ใช้และกำหนดบทบาท', badge: 'bg-violet-50 text-violet-800 border-violet-200', perms: ['view_docs', 'view_audit', 'manage_users'] },
];

const roleOf = (key: RoleKey) => ROLES.find((r) => r.key === key)!;

// ข้อมูลตัวอย่าง (เปลี่ยนเป็นข้อมูลจาก API ได้เลย)
const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: 'สมชาย กิตติกุล', email: 'somchai@example.co.th', organization: 'ทีมดูแลระบบ', roles: ['admin'], active: true },
  { id: 2, name: 'วิภา สุขสวัสดิ์', email: 'wipa@example.co.th', organization: 'ฝ่ายตรวจสอบ', roles: ['reviewer'], active: true },
  { id: 3, name: 'ธนา ปัญญาดี', email: 'thana@example.co.th', organization: 'ฝ่ายตรวจสอบ', roles: ['reviewer'], active: true },
  { id: 4, name: 'กมล วงศ์ไทย', email: 'kamol@siampattana.co.th', organization: 'บริษัท สยามพัฒนา จำกัด (มหาชน)', roles: ['submitter'], active: true },
  { id: 5, name: 'อารียา พงษ์ศรี', email: 'areeya@krungthai-leasing.co.th', organization: 'บริษัท กรุงไทยลิสซิ่ง จำกัด', roles: ['submitter'], active: true },
  { id: 6, name: 'นภา รัตนะ', email: 'napa@example.co.th', organization: 'ฝ่ายกำกับดูแล', roles: [], active: false },
];

export default function RolesPage() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [tab, setTab] = useState<'users' | 'matrix'>('users');
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'none' | RoleKey>('all');

  // modal จัดการบทบาท
  const [editing, setEditing] = useState<Employee | null>(null);
  const [draftRoles, setDraftRoles] = useState<RoleKey[]>([]);
  const [draftActive, setDraftActive] = useState(true);
  const [error, setError] = useState('');

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return employees.filter((u) => {
      const matchKw = !kw || [u.name, u.email, u.organization].some((v) => v.toLowerCase().includes(kw));
      const matchRole =
        roleFilter === 'all' || (roleFilter === 'none' ? u.roles.length === 0 : u.roles.includes(roleFilter));
      return matchKw && matchRole;
    });
  }, [employees, keyword, roleFilter]);

  const openEdit = (u: Employee) => {
    setEditing(u);
    setDraftRoles(u.roles);
    setDraftActive(u.active);
    setError('');
  };

  // เลือกได้เพียงบทบาทเดียว: เลือกใหม่จะแทนที่ของเดิม, กดซ้ำเพื่อยกเลิก
  const toggleRole = (key: RoleKey) => {
    setError('');
    setDraftRoles((prev) => (prev.includes(key) ? [] : [key]));
  };

  // สิทธิ์รวมที่จะได้รับจากบทบาทที่เลือก
  const draftPerms = useMemo(() => {
    const set = new Set<PermKey>();
    draftRoles.forEach((r) => roleOf(r).perms.forEach((p) => set.add(p)));
    return set;
  }, [draftRoles]);

  const handleSave = () => {
    if (!editing) return;

    // ต้องเหลือผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน
    const othersAdmin = employees.some((u) => u.id !== editing.id && u.active && u.roles.includes('admin'));
    const stillAdmin = draftActive && draftRoles.includes('admin');
    if (!othersAdmin && !stillAdmin) {
      setError('ต้องมีผู้ดูแลระบบที่ใช้งานอยู่อย่างน้อย 1 คน');
      return;
    }

    // TODO: เรียก API บันทึกที่นี่ แล้วค่อยอัปเดต state เมื่อสำเร็จ
    setEmployees((prev) => prev.map((u) => (u.id === editing.id ? { ...u, roles: draftRoles, active: draftActive } : u)));
    setEditing(null);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800">บทบาทและสิทธิ์</h1>

      <p className="mt-2 text-slate-500">
        หน้าจัดการบทบาทและสิทธิ์ของผู้ใช้ ผู้ใช้หนึ่งคนมีได้หลายบทบาท ยกเว้น &quot;บริษัทผู้ส่งเอกสาร&quot; และ &quot;เจ้าหน้าที่ตรวจสอบ&quot; ที่เป็นคนเดียวกันไม่ได้
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* แท็บ */}
        <div className="flex gap-6 border-b border-slate-200 mb-5">
          {[
            { key: 'users' as const, label: 'รายการผู้ใช้' },
            { key: 'matrix' as const, label: 'รายการบทบาทและสิทธิ์' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-2 text-sm -mb-px border-b-2 ${
                tab === t.key ? 'border-slate-800 text-slate-900 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">ค้นหา</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="ชื่อ, อีเมล, หน่วยงาน"
                  className="w-full border border-slate-300 rounded-md p-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">บทบาท</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as 'all' | 'none' | RoleKey)}
                  className="w-full border border-slate-300 rounded-md p-2 text-sm"
                >
                  <option value="all">ทุกบทบาท</option>
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                  <option value="none">ยังไม่ได้กำหนดบทบาท</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">ผู้ใช้</th>
                    <th className="px-4 py-3 text-left">หน่วยงาน</th>
                    <th className="px-4 py-3 text-left">บทบาท</th>
                    <th className="px-4 py-3 text-left">สถานะ</th>
                    <th className="px-4 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filtered.length > 0 ? (
                    filtered.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{u.name}</div>
                          <div className="text-xs text-slate-500">{u.email}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{u.organization}</td>
                        <td className="px-4 py-3">
                          {u.roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {u.roles.map((r) => (
                                <span key={r} className={`px-2.5 py-1 border rounded-full text-xs font-medium ${roleOf(r).badge}`}>
                                  {roleOf(r).label}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">ยังไม่ได้กำหนดบทบาท</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={u.active ? 'text-emerald-700' : 'text-slate-400'}>
                            {u.active ? 'ใช้งานอยู่' : 'ปิดการใช้งาน'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openEdit(u)}
                            className="border border-slate-300 text-slate-700 px-3 py-1.5 rounded-md text-xs hover:bg-slate-100"
                          >
                            จัดการบทบาท
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        ไม่พบผู้ใช้ที่ตรงกับตัวกรอง
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-slate-600 mt-4">
              แสดง {filtered.length} จาก {employees.length} คน
            </p>
          </>
        )}

        {tab === 'matrix' && (
          <>
            <p className="mb-4 text-sm text-slate-500">สิทธิ์ที่แต่ละบทบาทได้รับในระบบ</p>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">บทบาท</th>
                    {PERMISSIONS.map((p) => (
                      <th key={p.key} className="px-4 py-3 text-center">
                        {p.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {ROLES.map((r) => (
                    <tr key={r.key}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{r.label}</div>
                        <div className="text-xs text-slate-500">{r.desc}</div>
                      </td>
                      {PERMISSIONS.map((p) => (
                        <td key={p.key} className="px-4 py-3 text-center">
                          {r.perms.includes(p.key) ? (
                            <span className="text-emerald-600 font-bold" aria-label="มีสิทธิ์">✓</span>
                          ) : (
                            <span className="text-slate-300" aria-label="ไม่มีสิทธิ์">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal จัดการบทบาท */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800">จัดการบทบาท</h3>
            <p className="text-sm text-slate-500 mb-4">
              {editing.name} · {editing.email}
            </p>

            <div className="space-y-2 mb-4">
              {ROLES.map((r) => {
                const checked = draftRoles.includes(r.key);
                return (
                  <label
                    key={r.key}
                    className={`flex items-start gap-3 p-3 border rounded-lg ${
                      checked
                        ? 'border-slate-800 bg-slate-50 cursor-pointer'
                        : 'border-slate-200 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      checked={checked}
                      onChange={() => {}}
                      onClick={() => toggleRole(r.key)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{r.label}</span>
                      <span className="block text-xs text-slate-500">{r.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mb-4 text-sm">
              <div className="font-medium text-slate-700 mb-1">สิทธิ์ที่จะได้รับ</div>
              {draftPerms.size > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSIONS.filter((p) => draftPerms.has(p.key)).map((p) => (
                    <span key={p.key} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs">
                      {p.label}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-400">ยังไม่มีสิทธิ์ใช้งาน</span>
              )}
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
              <input type="checkbox" checked={draftActive} onChange={(e) => setDraftActive(e.target.checked)} />
              เปิดการใช้งานบัญชีนี้
            </label>

            {error && <p className="text-sm text-rose-600 mb-3">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-md hover:bg-slate-100">
                ยกเลิก
              </button>
              <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
                บันทึกบทบาท
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
