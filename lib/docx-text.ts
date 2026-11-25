import mammoth from 'mammoth'

/* อ่านไฟล์ Word เป็นข้อความ โดยคงโครงสร้างตารางไว้ (ป้าย | ค่า)
   ต่างจาก extractRawText ที่ทำให้ตารางกลายเป็นข้อความเรียงต่อกันจนจับคู่ป้ายกับค่าไม่ได้ */
export async function docxToText(buffer: Buffer): Promise<string> {
  const { value: html } = await mammoth.convertToHtml({ buffer })

  return html
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<\/(tr|p|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
