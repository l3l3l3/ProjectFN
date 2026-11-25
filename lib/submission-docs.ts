// วางไฟล์นี้ที่ src/lib/submission-docs.ts
// ตรรกะหาไฟล์ PDF ของรายการที่ส่งเอกสาร (ยกจาก submission-history.tsx เพื่อให้หน้าอื่นใช้ซ้ำได้)
import type { ApprovalItem } from "@/lib/approvals-store";

export type ApprovalFile = {
  name: string;
  size: number;
  documentId?: string;
  version?: string;
  documentType?: string;
};
export type VersionEntry = { version: string; submittedAt: string; files?: ApprovalFile[] };
export type StoredVersion = { version: string; fileName: string };
export type StoredDocument = {
  id: string;
  issuer?: string;
  symbol?: string;
  documentType?: string;
  title: string;
  versions: StoredVersion[];
};

export const normalize = (v: string) => v.trim().toLowerCase().replace(/[\s_-]+/g, "");
export const versionNumber = (v?: string) => Number(v?.match(/\d+/)?.[0] || 0);

const parts = (item: ApprovalItem) => item.title.split(/\s+[—–-]\s+/);
export const symbolOf = (item: ApprovalItem) =>
  item.symbol || (parts(item).length > 1 ? parts(item)[0] : "");
export const companyOf = (item: ApprovalItem) =>
  item.issuer || (parts(item).length > 1 ? parts(item)[1] : "");
export const isMine = (item: ApprovalItem) => item.submitter === "ฉัน";

export const formatSize = (bytes: number) => {
  if (!bytes) return "ไม่ระบุขนาด";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const BOND_SHEET_NAMES = ["แบบข้อมูลตราสารหนี้", "สำเนาข้อมูลตราสารหนี้"];
export const isBondSheetLabel = (label: string) => {
  const text = label.toLowerCase();
  return BOND_SHEET_NAMES.some((n) => text.includes(n)) || normalize(text).includes("bonddatasheet");
};
export const isMemorandumLabel = (label: string) => label.includes("บริคณห์สนธิ");

export const versionsOf = (item: ApprovalItem): VersionEntry[] => {
  const raw = item as unknown as {
    versionHistory?: VersionEntry[];
    files?: ApprovalFile[];
    version: string;
    submittedAt: string;
  };
  if (raw.versionHistory?.length) {
    return [...raw.versionHistory].sort((a, b) => versionNumber(a.version) - versionNumber(b.version));
  }
  return [{ version: raw.version, submittedAt: raw.submittedAt, files: raw.files ?? [] }];
};

export const bondSheetOf = (entry?: VersionEntry) =>
  entry?.files?.find((f) => isBondSheetLabel(`${f.documentType || ""} ${f.name || ""}`));

const findBondSheetDocument = (
  file: ApprovalFile | undefined,
  item: ApprovalItem,
  docs: StoredDocument[],
): StoredDocument | undefined => {
  const isBondDoc = (d: StoredDocument) => isBondSheetLabel(`${d.documentType || ""} ${d.title || ""}`);
  const issuer = normalize(companyOf(item));
  const symbol = normalize(symbolOf(item));
  const fileType = normalize(file?.documentType || "");
  const fileName = normalize(file?.name || "");

  const best = docs
    .map((d) => {
      let score = 0;
      const type = normalize(d.documentType || "");
      const title = normalize(d.title || "");
      if (file?.documentId && d.id === file.documentId) score += 1000;
      if (fileType && type === fileType) score += 120;
      if (fileType && title.includes(fileType)) score += 80;
      if (fileName && d.versions?.some((v) => normalize(v.fileName) === fileName)) score += 100;
      if (issuer && normalize(d.issuer || "") === issuer) score += 30;
      if (symbol && normalize(d.symbol || "") === symbol) score += 30;
      if (isBondDoc(d)) score += 10;
      return { d, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score > 0 && isBondDoc(best.d)) return best.d;

  const candidates = docs.filter(
    (d) =>
      isBondDoc(d) &&
      (!issuer || normalize(d.issuer || "") === issuer) &&
      (!symbol || normalize(d.symbol || "") === symbol),
  );
  return candidates.length === 1 ? candidates[0] : undefined;
};

const resolveStoredVersion = (
  doc: StoredDocument | undefined,
  file: ApprovalFile | undefined,
  entry: VersionEntry,
  versions: VersionEntry[],
) => {
  if (!doc?.versions?.length) return undefined;
  if (file?.version) {
    const exact = doc.versions.find((v) => v.version === file.version);
    if (exact) return exact;
  }
  if (file?.name) {
    const sameName = doc.versions.find((v) => normalize(v.fileName) === normalize(file.name));
    if (sameName) return sameName;
  }
  const historyIndex = versions.findIndex((h) => h.version === entry.version);
  if (historyIndex >= 0 && doc.versions.length >= versions.length) {
    const mapped = doc.versions[doc.versions.length - versions.length + historyIndex];
    if (mapped) return mapped;
  }
  const n = versionNumber(entry.version);
  return n ? doc.versions.find((v) => versionNumber(v.version) === n) : undefined;
};

export const docUrl = (id: string, version: string) =>
  `/api/documents?id=${encodeURIComponent(id)}&version=${encodeURIComponent(version)}`;

// URL ของ PDF "แบบข้อมูลตราสารหนี้" ในเวอร์ชันที่ระบุ (ไม่พบ = null)
export const bondSheetUrl = (
  item: ApprovalItem,
  entry: VersionEntry,
  versions: VersionEntry[],
  docs: StoredDocument[],
): string | null => {
  const file = bondSheetOf(entry);
  const doc = findBondSheetDocument(file, item, docs);
  const stored = resolveStoredVersion(doc, file, entry, versions);
  if (!doc || !stored) return null;
  return docUrl(doc.id, stored.version);
};
