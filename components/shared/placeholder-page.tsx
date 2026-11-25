export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <div className="mt-6 grid h-72 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white text-slate-500">
        หน้านี้ยังไม่มีในดีไซน์ (PDF) — รอเพิ่มภายหลัง
      </div>
    </div>
  );
}
