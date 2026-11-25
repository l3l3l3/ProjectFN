
import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID, createHash } from 'crypto'

type DocumentVersion = {
  version: string
  fileName: string
  storedName: string
  storagePath: string
  uploadedAt: string
  size: number
}

type DocumentRecord = {
  id: string
  issuer?: string
  symbol?: string
  documentType?: string
  title: string
  createdAt: string
  versions: DocumentVersion[]
}

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'documents')
const INDEX_FILE = path.join(STORAGE_DIR, 'index.json')
const MAX_FILE_SIZE = 20 * 1024 * 1024

// ทำชื่อโฟลเดอร์ให้อ่านง่ายและปลอดภัย
function folderName(value: string) {
  const slug = value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)

  const hash = createHash('sha256')
    .update(value.trim().toLowerCase())
    .digest('hex')
    .slice(0, 8)

  return `${slug || 'document'}-${hash}`
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

async function readDocuments(): Promise<DocumentRecord[]> {
  try {
    const data = await readFile(INDEX_FILE, 'utf8')
    const parsed = JSON.parse(data)

    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function saveDocuments(documents: DocumentRecord[]) {
  await mkdir(STORAGE_DIR, { recursive: true })

  await writeFile(
    INDEX_FILE,
    JSON.stringify(documents, null, 2),
    'utf8'
  )
}

// อ่านข้อมูลคลังเอกสาร หรือส่งไฟล์ PDF ตาม id และ version
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const versionName = searchParams.get('version')

    // ถ้าระบุ id และ version ให้ส่งไฟล์ PDF จริงกลับไป
    if (id && versionName) {
      const documents = await readDocuments()
      const document = documents.find((item) => item.id === id)

      if (!document) {
        return NextResponse.json(
          { error: 'ไม่พบเอกสารที่ระบุ' },
          { status: 404 }
        )
      }

      const version = document.versions.find(
        (item) => item.version === versionName
      )

      if (!version) {
        return NextResponse.json(
          { error: 'ไม่พบเวอร์ชันที่ระบุ' },
          { status: 404 }
        )
      }

      // ป้องกัน path traversal โดยอนุญาตให้อ่านเฉพาะไฟล์ภายใน STORAGE_DIR
      const filePath = path.resolve(STORAGE_DIR, version.storagePath)
      const storageRoot = path.resolve(STORAGE_DIR) + path.sep

      if (!filePath.startsWith(storageRoot)) {
        return NextResponse.json(
          { error: 'ตำแหน่งไฟล์ไม่ถูกต้อง' },
          { status: 400 }
        )
      }

      const pdfBuffer = await readFile(filePath)

      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${encodeURIComponent(version.fileName || version.storedName)}"`,
          'Content-Length': String(pdfBuffer.length),
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    // ถ้าไม่ระบุ id/version ให้ทำงานแบบเดิม: ส่งรายการเอกสารเป็น JSON
    const documents = await readDocuments()

    return NextResponse.json({
      success: true,
      documents,
    })
  } catch (error) {
    console.error('GET documents error:', error)

    return NextResponse.json(
      { error: 'ไม่สามารถอ่านคลังเอกสารได้' },
      { status: 500 }
    )
  }
}

// อัปโหลดเอกสารและสร้างเวอร์ชัน
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const file = formData.get('file')
    const issuer = String(formData.get('issuer') || '').trim()
    const symbol = String(formData.get('symbol') || '').trim()
    const documentType = String(
      formData.get('documentType') || ''
    ).trim()

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'กรุณาเลือกไฟล์ PDF' },
        { status: 400 }
      )
    }

    if (!issuer || !symbol || !documentType) {
      return NextResponse.json(
        { error: 'กรุณาระบุบริษัท ชื่อตราสาร และประเภทเอกสาร' },
        { status: 400 }
      )
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'รองรับเฉพาะไฟล์ PDF' },
        { status: 400 }
      )
    }

    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ไฟล์ต้องมีขนาดไม่เกิน 20 MB และไม่เป็นไฟล์ว่าง' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (buffer.subarray(0, 5).toString() !== '%PDF-') {
      return NextResponse.json(
        { error: 'ไฟล์ PDF ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    await mkdir(STORAGE_DIR, { recursive: true })

    const documents = await readDocuments()

    // ค้นหาเอกสารเดิมจากบริษัท + ตราสาร + ประเภทเอกสาร
    let document = documents.find((item) =>
      normalize(item.issuer || '') === normalize(issuer) &&
      normalize(item.symbol || '') === normalize(symbol) &&
      normalize(item.documentType || '') === normalize(documentType)
    )

    // ถ้ายังไม่มี ให้สร้างรายการเอกสารใหม่
    if (!document) {
      document = {
        id: randomUUID(),
        issuer,
        symbol,
        documentType,
        title: `${symbol} - ${documentType}`,
        createdAt: new Date().toISOString(),
        versions: [],
      }

      documents.push(document)
    }

    // สร้างโครงสร้างโฟลเดอร์
    const issuerDir = folderName(issuer)
    const symbolDir = folderName(symbol)
    const typeDir = folderName(documentType)

    const relativeDir = path.join(
      issuerDir,
      symbolDir,
      typeDir
    )

    const documentDir = path.join(STORAGE_DIR, relativeDir)

    await mkdir(documentDir, { recursive: true })

    // เพิ่มเวอร์ชันใหม่
    // ครั้งแรกของชื่อนี้ (ยังไม่มีเวอร์ชัน) จะได้ v1
    // ครั้งต่อไปใช้เลขสูงสุดที่มีอยู่ + 1 เพื่อไม่ให้ซ้ำหรือทับไฟล์เดิม
    const nextVersion =
      document.versions.reduce((max, item) => {
        const n = parseInt(item.version.replace(/^v/i, ''), 10)
        return Number.isNaN(n) ? max : Math.max(max, n)
      }, 0) + 1
    const storedName = `v${nextVersion}.pdf`

    await writeFile(
      path.join(documentDir, storedName),
      buffer
    )

    const version: DocumentVersion = {
      version: `v${nextVersion}`,
      fileName: file.name,
      storedName,
      storagePath: path.join(relativeDir, storedName),
      uploadedAt: new Date().toISOString(),
      size: file.size,
    }

    document.versions.push(version)

    await saveDocuments(documents)

    return NextResponse.json({
      success: true,
      message: 'บันทึกเอกสารสำเร็จ',
      document,
    })
  } catch (error) {
    console.error('Document upload error:', error)

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการบันทึกเอกสาร' },
      { status: 500 }
    )
  }
}
