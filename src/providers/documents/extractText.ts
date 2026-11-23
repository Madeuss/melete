/*
 * Reads the text out of a CV in the browser. The file never leaves the device and isn't kept:
 * only the extracted text is used. The libraries load on first use, so the rest of the app
 * doesn't carry them.
 */
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/** CVs are small; anything bigger is probably the wrong file. */
export const MAX_CV_BYTES = 5 * 1024 * 1024

export class DocumentError extends Error {
  readonly kind: 'too-large' | 'unsupported' | 'unreadable' | 'empty'
  constructor(kind: DocumentError['kind'], cause?: unknown) {
    super(`Document error: ${kind}`, { cause })
    this.name = 'DocumentError'
    this.kind = kind
  }
}

function kindOf(file: File): 'pdf' | 'docx' | undefined {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx'))
    return 'docx'
  return undefined
}

async function pdfText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  // Text only: no WebAssembly image decoders needed.
  const task = pdfjs.getDocument({ data, useWasm: false })
  const doc = await task.promise
  const pages: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    pages.push(
      content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n'),
    )
  }
  await task.destroy()
  return pages.join('\n\n')
}

async function docxText(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth/mammoth.browser.js')
  return (await mammoth.extractRawText({ arrayBuffer: data })).value
}

/** PDF or DOCX → plain text, with blank lines collapsed. */
export async function extractText(file: File): Promise<string> {
  if (file.size > MAX_CV_BYTES) throw new DocumentError('too-large')
  const kind = kindOf(file)
  if (!kind) throw new DocumentError('unsupported')
  let text: string
  try {
    const data = await file.arrayBuffer()
    text = kind === 'pdf' ? await pdfText(data) : await docxText(data)
  } catch (err) {
    throw new DocumentError('unreadable', err)
  }
  const clean = text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) throw new DocumentError('empty')
  return clean
}
