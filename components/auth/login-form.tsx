"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/shared/icon";
import { roleConfig } from "@/lib/roles";
import { setSession, type Role } from "@/lib/session";

const options: { label: string; role: Role }[] = [
  { label: "บริษัท aaa", role: "company" },
  { label: "บริษัท bbb", role: "company" },
  { label: "บริษัท ccc", role: "company" },
  { label: "ตัวแทนบริษัท", role: "company" },
  { label: "เจ้าหน้าที่ตรวจสอบ", role: "officer" },
  { label: "ผู้ดูแลระบบ (Admin)", role: "admin" },
];

// ---- บัญชีผู้ใช้ (เก็บใน localStorage เพราะโปรเจกต์ยังไม่มี backend) ----
const ACCOUNTS_KEY = "bond-portal-accounts";
type Account = { email: string; hash: string };
type Accounts = Record<string, Account>; // key = label ของบทบาท/บริษัท

function loadAccounts(): Accounts {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveAccounts(a: Accounts) {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(a));
  } catch {}
}

async function hashPassword(label: string, pw: string) {
  const text = `${label}:${pw}`;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // กรณีเบราว์เซอร์ไม่รองรับ (เช่นเปิดผ่าน http ที่ไม่ใช่ localhost)
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return String(h);
}

const MIN_PASSWORD = 6;
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Mode = "login" | "register" | "forgot";

export function LoginForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof options)[number] | null>(null);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [confirm, setConfirm] = useState("");
  const [info, setInfo] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const switchMode = (m: Mode) => {
    setMode(m);
    setPassword("");
    setConfirm("");
    setEmail("");
    setError("");
    setInfo("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return setError("กรุณาเลือกบทบาทของคุณ");
    const accounts = loadAccounts();
    const account = accounts[selected.label];

    if (mode === "register") {
      if (!emailOk(email.trim())) return setError("กรุณากรอกอีเมลให้ถูกต้อง");
      if (password.length < MIN_PASSWORD)
        return setError(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
      if (password !== confirm) return setError("ยืนยันรหัสผ่านไม่ตรงกัน");
      if (account) return setError("บทบาทนี้ลงทะเบียนไว้แล้ว กรุณาเข้าสู่ระบบหรือใช้ลืมรหัสผ่าน");
      accounts[selected.label] = {
        email: email.trim().toLowerCase(),
        hash: await hashPassword(selected.label, password),
      };
      saveAccounts(accounts);
      switchMode("login");
      setInfo("ลงทะเบียนสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านที่ตั้งไว้");
      return;
    }

    if (mode === "forgot") {
      if (!account) return setError("บทบาทนี้ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อน");
      if (email.trim().toLowerCase() !== account.email)
        return setError("อีเมลไม่ตรงกับที่ลงทะเบียนไว้");
      if (password.length < MIN_PASSWORD)
        return setError(`รหัสผ่านใหม่ต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`);
      if (password !== confirm) return setError("ยืนยันรหัสผ่านไม่ตรงกัน");
      accounts[selected.label] = {
        ...account,
        hash: await hashPassword(selected.label, password),
      };
      saveAccounts(accounts);
      switchMode("login");
      setInfo("ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ");
      return;
    }

    // mode === "login"
    if (!password) return setError("กรุณากรอกรหัสผ่าน");
    if (!account) return setError("บทบาทนี้ยังไม่ได้ลงทะเบียน กรุณาลงทะเบียนก่อนเข้าสู่ระบบ");
    if (account.hash !== (await hashPassword(selected.label, password)))
      return setError("รหัสผ่านไม่ถูกต้อง");
    setError("");
    setInfo("");
    setSession({ role: selected.role, label: selected.label });
    // แต่ละ role มีหน้าแรกของตัวเอง (ดู lib/roles.ts)
    router.push(roleConfig[selected.role].home);
  };

  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-[412px] rounded-2xl bg-white p-6 shadow-2xl"
        noValidate
      >
        <h1 className="text-xl font-bold text-slate-900">
          {mode === "login" ? "เข้าสู่ระบบ" : mode === "register" ? "ลงทะเบียน" : "ลืมรหัสผ่าน"}
        </h1>

        <div className="mt-5" ref={boxRef}>
          <label className="text-sm font-bold text-slate-900">เลือกบทบาทของคุณ</label>
          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={open}
              className="flex h-[58px] w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 text-left text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            >
              <span className={selected ? "" : "text-slate-900"}>
                {selected ? selected.label : "บริษัทของคุณ"}
              </span>
              <Icon
                name="chevron"
                className={`size-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
              />
            </button>
            {open && (
              <ul
                role="listbox"
                className="absolute inset-x-0 top-0 z-10 overflow-hidden rounded-xl border border-slate-200 bg-white pt-1 pb-2 shadow-xl"
              >
                {options.map((o) => (
                  <li key={o.label} role="option" aria-selected={selected?.label === o.label}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(o);
                        setOpen(false);
                        setError("");
                      }}
                      className="block w-full px-4 py-2.5 text-left text-slate-900 hover:bg-brand-50"
                    >
                      {o.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {mode !== "login" && (
          <div className="mt-5">
            <label htmlFor="email" className="text-sm font-bold text-slate-900">
              อีเมล
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              autoComplete="email"
              className="mt-2 h-[58px] w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        )}

        <div className="mt-5">
          <label htmlFor="password" className="text-sm font-bold text-slate-900">
            {mode === "forgot" ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="mt-2 h-[58px] w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        {mode !== "login" && (
          <div className="mt-5">
            <label htmlFor="confirm" className="text-sm font-bold text-slate-900">
              ยืนยันรหัสผ่าน
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError("");
              }}
              autoComplete="new-password"
              className="mt-2 h-[58px] w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
        )}

        {info && <p className="mt-3 text-sm text-emerald-600">{info}</p>}
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          className="mt-6 h-[58px] w-full rounded-xl bg-brand text-base font-bold text-white transition-colors hover:bg-brand-600"
        >
          {mode === "login" ? "เข้าสู่ระบบ" : mode === "register" ? "ลงทะเบียน" : "ตั้งรหัสผ่านใหม่"}
        </button>

        {mode === "login" ? (
          <div className="mt-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => switchMode("register")}
              className="text-sm text-slate-900 underline underline-offset-2"
            >
              ลงทะเบียน
            </button>
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-sm text-slate-900 underline underline-offset-2"
            >
              ลืมรหัสผ่าน
            </button>
          </div>
        ) : (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="text-sm text-slate-900 underline underline-offset-2"
            >
              กลับไปเข้าสู่ระบบ
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
