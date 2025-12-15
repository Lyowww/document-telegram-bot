import fs from 'node:fs/promises'
import path from 'node:path'
import { findDocumentByToken } from '../../lib/documents'

export default async function SecondPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams
  const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params.token[0] : undefined
  
  const htmlPath = path.join(process.cwd(), 'public', 'second-page', 'index.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')
  
  let regNumber = '202511092252046'
  let regDate = '25.07.2025'
  let notaryName = 'AZIZOVA INTIZORA XUSENOVNA'
  let notaryOffice = 'Самарқанд вилояти Самарқанд шаҳридаги хусусий амалиёт билан шуғулланувчи нотариус'
  
  if (token) {
    const doc = await findDocumentByToken(token)
    if (doc && doc.type === 'NOTARY') {
      if (doc.docNumber) regNumber = doc.docNumber
      if (doc.generatedDate) {
        const [year, month, day] = doc.generatedDate.split('-')
        regDate = `${day}.${month}.${year}`
      } else if (doc.generatedDateTime) {
        const dateMatch = doc.generatedDateTime.match(/(\d{2})[.\s](\d{2})\.(\d{4})/)
        if (dateMatch) {
          regDate = `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`
        } else {
          const dateMatch2 = doc.generatedDateTime.match(/(\d{4})-(\d{2})-(\d{2})/)
          if (dateMatch2) {
            regDate = `${dateMatch2[3]}.${dateMatch2[2]}.${dateMatch2[1]}`
          }
        }
      }
      if (doc.notaryName) notaryName = doc.notaryName.toUpperCase()
      if (doc.docDate) {
        const [year, month, day] = doc.docDate.split('-')
        regDate = `${day}.${month}.${year}`
      }
    }
  }
  
  htmlContent = htmlContent.replace(/<span[^>]*id="reg-number-value"[^>]*>\s*\{\{REG_NUMBER\}\}\s*<\/span>/gi, `<span id="reg-number-value">${regNumber}</span>`)
  htmlContent = htmlContent.replace(/<span[^>]*id="reg-date-value"[^>]*>\s*\{\{REG_DATE\}\}\s*<\/span>/gi, `<span id="reg-date-value">${regDate}</span>`)
  htmlContent = htmlContent.replace(/\{\{REG_NUMBER\}\}/g, regNumber)
  htmlContent = htmlContent.replace(/\{\{REG_DATE\}\}/g, regDate)
  htmlContent = htmlContent.replace(/AZIZOVA INTIZORA XUSENOVNA/g, notaryName)
  htmlContent = htmlContent.replace(/Самарқанд вилояти Самарқанд шаҳридаги хусусий амалиёт билан шуғулланувчи нотариус/g, notaryOffice)
  
  htmlContent = htmlContent.replace(/href="css\//g, 'href="/second-page/css/')
  htmlContent = htmlContent.replace(/src="images\//g, 'src="/second-page/images/')
  htmlContent = htmlContent.replace(/src="js\//g, 'src="/second-page/js/')
  htmlContent = htmlContent.replace(/src="chunk-vendors/g, 'src="/second-page/chunk-vendors')
  htmlContent = htmlContent.replace(/src="app\./g, 'src="/second-page/app.')
  htmlContent = htmlContent.replace(/src="adapter-latest/g, 'src="/second-page/adapter-latest')
  htmlContent = htmlContent.replace(/href="\.\/Нотариал/g, 'href="/second-page/Нотариал')
  
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  let bodyContent = bodyMatch ? bodyMatch[1] : htmlContent
  
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  bodyContent = bodyContent.replace(/<span[^>]*id="reg-number-value"[^>]*>\s*\{\{REG_NUMBER\}\}\s*<\/span>/gi, `<span id="reg-number-value">${regNumber}</span>`)
  bodyContent = bodyContent.replace(/<span[^>]*id="reg-date-value"[^>]*>\s*\{\{REG_DATE\}\}\s*<\/span>/gi, `<span id="reg-date-value">${regDate}</span>`)
  bodyContent = bodyContent.replace(/\{\{REG_NUMBER\}\}/g, regNumber)
  bodyContent = bodyContent.replace(/\{\{REG_DATE\}\}/g, regDate)
  bodyContent = bodyContent.replace(/AZIZOVA INTIZORA XUSENOVNA/g, notaryName)
  bodyContent = bodyContent.replace(/Самарқанд вилояти Самарқанд шаҳридаги хусусий амалиёт билан шуғулланувчи нотариус/g, notaryOffice)
  
  return (
    <>
      <link
        href="https://cdn.jsdelivr.net/npm/@mdi/font/css/materialdesignicons.min.css"
        rel="stylesheet"
      />
      <link
        href="/second-page/Нотариал%20ҳаракат%20текширув%20натижаси%20-%20Электрон%20нотариус_files/chunk-vendors.38b718b4.css"
        rel="stylesheet"
      />
      <link
        href="/second-page/Нотариал%20ҳаракат%20текширув%20натижаси%20-%20Электрон%20нотариус_files/app.521891da.css"
        rel="stylesheet"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="/second-page/Нотариал%20ҳаракат%20текширув%20натижаси%20-%20Электрон%20нотариус_files/main.1e2f1776.css"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="/second-page/Нотариал%20ҳаракат%20текширув%20натижаси%20-%20Электрон%20нотариус_files/dict.b4e9cd15.css"
      />
      <link
        rel="stylesheet"
        type="text/css"
        href="/second-page/Нотариал%20ҳаракат%20текширув%20натижаси%20-%20Электрон%20нотариус_files/search_notarial_acts.abc9b748.css"
      />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  )
}

