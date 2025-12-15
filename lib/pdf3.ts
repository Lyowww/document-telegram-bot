import QRCode from 'qrcode'
import fs from 'node:fs/promises'
import path from 'node:path'
import puppeteer from 'puppeteer'
import { createTokenWithPin, setBytesForToken } from './store'
import { saveDocumentMeta } from './documents'

export type SecondInput = {
  notaryName: string
  translatorName: string
  location?: string
  address?: string
}

export type GeneratedSecond = {
  token: string
  pin: string
  bytes: Uint8Array
  fileName: string
  verifyUrl: string
  generatedAt: Date
  regNumber: string
}

function getBaseUrl(): string {
  const env = "https://e-notarius.online"
  return env
}

function generate4DigitPin(): string {
  const n = Math.floor(Math.random() * 10_000)
  return n.toString().padStart(4, '0')
}

function pickWeekdayDateWithTime(now = new Date()): Date {
  const d = new Date(now)
  const dayOfWeek = d.getDay()
  
  if (dayOfWeek === 0) {
    d.setDate(d.getDate() - 2)
  } else if (dayOfWeek === 6) {
    d.setDate(d.getDate() - 1)
  }
  
  const hour = 8 + Math.floor(Math.random() * 11)
  const minute = Math.floor(Math.random() * 60)
  const second = Math.floor(Math.random() * 60)
  d.setHours(hour, minute, second, 0)
  
  return d
}

function formatDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function formatDateRussian(d: Date): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ]
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  
  const dayWords = [
    '', 'первое', 'второе', 'третье', 'четвертое', 'пятое',
    'шестое', 'седьмое', 'восьмое', 'девятое', 'десятое',
    'одиннадцатое', 'двенадцатое', 'тринадцатое', 'четырнадцатое', 'пятнадцатое',
    'шестнадцатое', 'семнадцатое', 'восемнадцатое', 'девятнадцатое', 'двадцатое',
    'двадцать первое', 'двадцать второе', 'двадцать третье', 'двадцать четвертое', 'двадцать пятое',
    'двадцать шестое', 'двадцать седьмое', 'двадцать восьмое', 'двадцать девятое', 'тридцатое',
    'тридцать первое'
  ]
  
  const yearStr = year.toString()
  let yearText = ''
  
  if (yearStr.startsWith('20')) {
    yearText = 'Две тысячи '
    const remainder = parseInt(yearStr.substring(2))
    if (remainder < 20) {
      const teenOrdinals = ['десятый', 'одиннадцатый', 'двенадцатый', 'тринадцатый', 'четырнадцатый', 'пятнадцатый', 'шестнадцатый', 'семнадцатый', 'восемнадцатый', 'девятнадцатый']
      yearText += teenOrdinals[remainder - 10] + ' '
    } else {
      const tens = Math.floor(remainder / 10)
      const ones = remainder % 10
      const tensWords = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
      const onesWords = ['', 'первый', 'второй', 'третий', 'четвертый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый']
      yearText += tensWords[tens] + (ones > 0 ? ' ' + onesWords[ones] : '') + ' '
    }
    yearText += 'год'
  }
  
  const dayText = dayWords[day - 1]
  const daySentence = dayText ? dayText.charAt(0).toUpperCase() + dayText.slice(1) : ''
  
  return `${yearText}.${daySentence} ${month}.`
}

function formatDateEnglish(d: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const day = d.getDate()
  const month = months[d.getMonth()]
  const year = d.getFullYear()
  
  const yearWords = numberToWords(year)
  const yearCapitalized = yearWords ? yearWords.charAt(0).toUpperCase() + yearWords.slice(1) : ''
  
  return `${month} ${day},${yearCapitalized}`
}

function numberToWords(num: number): string {
  if (num === 0) return 'zero'
  
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return tens[ten] + (one > 0 ? '-' + ones[one] : '')
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100)
    const remainder = num % 100
    return ones[hundred] + ' hundred' + (remainder > 0 ? ' ' + numberToWords(remainder) : '')
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000)
    const remainder = num % 1000
    return numberToWords(thousand) + ' thousand' + (remainder > 0 ? ' ' + numberToWords(remainder) : '')
  }
  
  return num.toString()
}

function generateRegistrationNumber(): string {
  const year = new Date().getFullYear()
  const random = Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('')
  return `${year}${random}`
}

function formatNumberToWords(num: number): string {
  const ones = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять']
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать']
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто']
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот']
  
  if (num === 0) return 'ноль'
  
  if (num < 10) return ones[num]
  if (num < 20) return teens[num - 10]
  if (num < 100) {
    const ten = Math.floor(num / 10)
    const one = num % 10
    return tens[ten] + (one > 0 ? ' ' + ones[one] : '')
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100)
    const remainder = num % 100
    return hundreds[hundred] + (remainder > 0 ? ' ' + formatNumberToWords(remainder) : '')
  }
  if (num < 20000) {
    const thousand = Math.floor(num / 1000)
    const remainder = num % 1000
    if (thousand === 1) {
      return 'одна тысяча' + (remainder > 0 ? ' ' + formatNumberToWords(remainder) : '')
    }
    if (thousand < 5) {
      const thousandWords = ['', '', 'две тысячи', 'три тысячи', 'четыре тысячи']
      return thousandWords[thousand] + (remainder > 0 ? ' ' + formatNumberToWords(remainder) : '')
    }
    if (thousand < 20) {
      return formatNumberToWords(thousand) + ' тысяч' + (remainder > 0 ? ' ' + formatNumberToWords(remainder) : '')
    }
  }
  
  const thousand = Math.floor(num / 1000)
  const remainder = num % 1000
  const thousandPart = formatNumberToWords(thousand)
  const lastDigit = thousand % 10
  let thousandSuffix = ' тысяч'
  if (lastDigit === 1 && (thousand % 100) !== 11) {
    thousandSuffix = ' тысяча'
  } else if (lastDigit >= 2 && lastDigit <= 4 && (thousand % 100) < 10 || (thousand % 100) >= 20) {
    thousandSuffix = ' тысячи'
  }
  return thousandPart + thousandSuffix + (remainder > 0 ? ' ' + formatNumberToWords(remainder) : '')
}

async function htmlToPdf(htmlContent: string): Promise<Uint8Array> {
  let browser
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    })
    const page = await browser.newPage()
    
    page.setDefaultNavigationTimeout(120000)
    page.setDefaultTimeout(120000)
    
    await page.setContent(htmlContent, {
      waitUntil: 'load',
      timeout: 120000,
    })
    
    await page.addStyleTag({
      content: `
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          font-family: Arial, sans-serif !important;
        }
        html, body {
          height: auto !important;
          overflow: visible !important;
          page-break-after: avoid !important;
          page-break-inside: avoid !important;
          font-family: Arial, sans-serif !important;
        }
        @page {
          size: A4;
          margin: 0;
        }
        img {
          display: block !important;
          visibility: visible !important;
          max-width: 100% !important;
          opacity: 1 !important;
        }
      `
    })
    
    await page.evaluateHandle(() => document.fonts.ready)
    
    await page.evaluate(() => {
      const images = document.querySelectorAll('img')
      return Promise.all(
        Array.from(images).map((img: HTMLImageElement) => {
          if (img.complete) return Promise.resolve()
          return new Promise((resolve, reject) => {
            img.onload = resolve
            img.onerror = resolve
            setTimeout(resolve, 1000)
          })
        })
      )
    })
    
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0',
        right: '0',
        bottom: '0',
        left: '0',
      },
      preferCSSPageSize: false,
      displayHeaderFooter: false,
      timeout: 120000,
      scale: 1,
      pageRanges: '1',
    })
    
    return new Uint8Array(pdfBuffer)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

export function parseSecondText(input: string): SecondInput {
  const parts = input.split(',').map((p) => p.trim()).filter(Boolean)
  const [notaryName, translatorName, location, address] = parts
  return {
    notaryName: notaryName || '',
    translatorName: translatorName || '',
    location: location || 'Самаркандская область, город Самарканд',
    address: address || 'улица А. Жомий, дом 64, город Самарканд, Самаркандская область',
  }
}

export async function generateSecondPdf(input: SecondInput): Promise<GeneratedSecond> {
  const pin = generate4DigitPin()
  const token = createTokenWithPin(pin)
  const baseUrl = getBaseUrl()
  const verifyUrl = `${baseUrl}/?token=${token}`
  
  const generatedAt = pickWeekdayDateWithTime(new Date())
  const regNumber = generateRegistrationNumber()
  
  const dateStr = formatDate(generatedAt)
  const dateTime = `${dateStr.replace(/^(\d{2})\./, '$1 ')}, ${formatTime(generatedAt)}`
  const dateRussian = formatDateRussian(generatedAt)
  const dateEnglish = formatDateEnglish(generatedAt)
  
  const locationRu = input.location || 'Самаркандская область, город Самарканд'
  const locationEn = locationRu
    .replace('Самаркандская область', 'Samarkand region')
    .replace('город Самарканд', 'Samarkand city')
    .replace('Республика Узбекистан', 'Republic of Uzbekistan')
  
  const addressRu = input.address || 'ул. А. Жомий, дом 64, город Самарканд, Самаркандская область'
  
  const notaryNameUpper = input.notaryName.toUpperCase()
  const translatorNameUpper = input.translatorName.toUpperCase()
  
  const notaryStatementRu = `Я, ${notaryNameUpper} Нотариус, города Самарканда, Самаркандской области, занимающийся частной практикой расположенной по адресу: ${addressRu}, свидетельствую подлинность подписи известного мне переводчика ${translatorNameUpper}. Личность подписавшего документ установлена, дееспособность проверена, т.е, при личном общении с ним, его дееспособность, сомнений не вызвала.`
  
  const notaryStatementEn = `I, ${notaryNameUpper}, The Notary carrying out private activity in Samarkand city, Samarkand region, Republic of Uzbekistan, hereby have certified the authenticity of the forthcoming signature, affixed by the translator ${translatorNameUpper}, whom I personally know. The personality of the translator was determined, legal capacity was checked. There didn't arouse any doubt about him legal capacity during the personal communication and in the time of carrying out this notary act, there isn't any information about her incapability. Translator is warned about the responsibility for the Incorrect translation by the Notary.`
  
  const stateDuty = 3750.00
  const additionalFee = 16000.00
  
  const stateDutyWords = formatNumberToWords(Math.floor(stateDuty))
  const additionalFeeWords = formatNumberToWords(Math.floor(additionalFee))
  
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: 'M',
    margin: 0,
    scale: 6,
  })
  
  const htmlPath = path.join(process.cwd(), 'public', 'second.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')
  
  const locationFullRu = `Республика Узбекистан, ${locationRu}.`
  const locationFullEn = `Samarkand city, Samarkand region, Republic of Uzbekistan.`
  
  const stateDutyFormatted = stateDuty.toFixed(2).replace('.', ',')
  const additionalFeeFormatted = additionalFee.toFixed(2).replace('.', ',')
  
  htmlContent = htmlContent
    .replace(/{{DATE_TIME}}/g, dateTime)
    .replace(/{{LOCATION_DATE_RU}}/g, `${locationFullRu}\n${dateRussian}`)
    .replace(/{{NOTARY_STATEMENT_RU}}/g, notaryStatementRu)
    .replace(/{{REG_NUMBER}}/g, regNumber)
    .replace(/{{STATE_DUTY}}/g, stateDutyFormatted)
    .replace(/{{STATE_DUTY_WORDS}}/g, stateDutyWords)
    .replace(/{{ADDITIONAL_FEE}}/g, additionalFeeFormatted)
    .replace(/{{ADDITIONAL_FEE_WORDS}}/g, additionalFeeWords)
    .replace(/{{QR_CODE}}/g, `<img src="${qrDataUrl}" alt="QR Code" />`)
    .replace(/{{LOCATION_DATE_EN}}/g, `${locationFullEn}\n${dateEnglish}`)
    .replace(/{{NOTARY_STATEMENT_EN}}/g, notaryStatementEn)
    .replace(/{{STATE_DUTY_EN}}/g, stateDuty.toFixed(2))
    .replace(/{{ADDITIONAL_FEE_EN}}/g, additionalFeeFormatted.replace(',', '-'))
  
  const bytes = await htmlToPdf(htmlContent)
  setBytesForToken(token, bytes)
  
  const isoDate = `${generatedAt.getFullYear()}-${String(generatedAt.getMonth() + 1).padStart(2, '0')}-${String(generatedAt.getDate()).padStart(2, '0')}`
  
  await saveDocumentMeta({
    token,
    pin,
    type: 'NOTARY',
    createdAt: new Date(),
    verifyUrl,
    generatedDate: isoDate,
    generatedDateTime: dateTime,
    docNumber: regNumber,
    docDate: isoDate,
    notaryName: input.notaryName,
    translatorName: input.translatorName,
  })
  
  return {
    token,
    pin,
    bytes,
    fileName: `NOTARY_${regNumber}_${Date.now()}.pdf`,
    verifyUrl,
    generatedAt,
    regNumber,
  }
}

