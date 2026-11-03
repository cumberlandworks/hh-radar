// fix29: pdftotext isn't installed on TJ's Mac; PDFKit is. Usage: swift pdf2txt.swift <file.pdf>
// (curl the PDF to a scratch folder first). Prints each page's text.
import Foundation
import PDFKit
guard CommandLine.arguments.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1])) else {
  FileHandle.standardError.write("usage: swift pdf2txt.swift <file.pdf>\n".data(using: .utf8)!); exit(2)
}
for i in 0..<doc.pageCount { print("--- page \(i + 1)"); print(doc.page(at: i)?.string ?? "") }
