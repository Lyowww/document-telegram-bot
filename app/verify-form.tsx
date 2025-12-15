'use client'

import { useState, FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import Script from 'next/script'

export default function VerifyForm() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') || ''
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Токен не найден')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, pin }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError('Неправильный ПИН код')
        setLoading(false)
        return
      }
      window.location.href = data.fileUrl as string
    } catch {
      setError('Ошибка. Попробуйте позже.')
      setLoading(false)
    }
  }

  return (
    <>
      <link href="/first-page/css/bootstrap.min.css" rel="stylesheet" />
      <link href="/first-page/css/site.min.css" rel="stylesheet" />
      <link href="/first-page/css/site.css" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        span.im-caret {
          -webkit-animation: 1s blink step-end infinite;
          animation: 1s blink step-end infinite;
        }
        @keyframes blink {
          from, to { border-right-color: black; }
          50% { border-right-color: transparent; }
        }
        @-webkit-keyframes blink {
          from, to { border-right-color: black; }
          50% { border-right-color: transparent; }
        }
        span.im-static { color: grey; }
        .help-block-alert { color: red !important; }
        .control-label-alert { color: red !important; }
        .input-alert { border-color: red !important; }
        div.im-colormask {
          display: inline-block;
          border-style: inset;
          border-width: 2px;
          -webkit-appearance: textfield;
          -moz-appearance: textfield;
          appearance: textfield;
        }
        div.im-colormask > input {
          position: absolute;
          display: inline-block;
          background-color: transparent;
          color: transparent;
          -webkit-appearance: caret;
          -moz-appearance: caret;
          appearance: caret;
          border-style: none;
          left: 0;
        }
        div.im-colormask > input:focus { outline: none; }
        div.im-colormask > input::-moz-selection { background: none; }
        div.im-colormask > input::selection { background: none; }
        div.im-colormask > div {
          color: black;
          display: inline-block;
          width: 100px;
        }
      `}} />
      <div className="wrap another_wrap">
        <nav id="w2" className="navbar-inverse navbar-fixed-top navbar">
          <div className="navbar-header">
            <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#w2-collapse">
              <span className="sr-only">Toggle navigation</span>
              <span className="icon-bar"></span>
              <span className="icon-bar"></span>
              <span className="icon-bar"></span>
            </button>
            <a className="navbar-brand" href="/">
              <img src="/first-page/images/mygov.png" alt="Logo" />
            </a>
          </div>
          <div id="w2-collapse" className="collapse navbar-collapse">
            <ul id="w3" className="navbar-nav navbar-right nav">
              <li><a href="/">Главная</a></li>
              <li><a href="/site/login">Войти</a></li>
            </ul>
          </div>
        </nav>
        <nav id="w4" className="navbar-inverse navbar-fixed-top m_mobile navbar">
          <div className="navbar-header">
            <button type="button" className="navbar-toggle" data-toggle="collapse" data-target="#w4-collapse">
              <span className="sr-only">Toggle navigation</span>
              <span className="icon-bar"></span>
              <span className="icon-bar"></span>
              <span className="icon-bar"></span>
            </button>
            <a className="navbar-brand" href="/">
              <img src="/first-page/images/logo_mobile.png" alt="Logo" />
            </a>
          </div>
          <div id="w4-collapse" className="collapse navbar-collapse">
            <ul id="w5" className="navbar-nav navbar-right nav">
              <li><a href="/">Главная</a></li>
              <li><a href="/site/login">Войти</a></li>
            </ul>
          </div>
        </nav>
        <div className="container ">
          <div className="container_in">
            <div className="row dflex_repo_row">
              <div className="col-md-6 vcenter vcenter_first">
                <div id="w0" className="alert-warning alert fade in">
                  <button type="button" className="close" data-dismiss="alert" aria-hidden="true">×</button>
                  Пожалуйста пройдите авторизацию чтобы система определила вас. Если документ принадлежит вам, введения ПИН кода не требуется. <a href="/auth/login">Нажмите здесь для авторизации</a>
                </div>
                <h3 className="repo_qr_info">Введите PIN-код для просмотра документа</h3>
                <form id="w1" className="pinForm col-md-6" method="post" onSubmit={onSubmit}>
                  <div className="form-group field-repopinmodel-pin_code required">
                    <label className={`control-label ${error ? 'control-label-alert' : ''}`} htmlFor="repopinmodel-pin_code">
                      ПИН код
                    </label>
                    <input
                      type="text"
                      id="repopinmodel-pin_code"
                      className={`form-control ${error ? 'input-alert' : ''}`}
                      name="RepoPinModel[pin_code]"
                      autoComplete="off"
                      aria-required="true"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      maxLength={4}
                      required
                    />
                    <div className={`help-block ${error ? 'help-block-alert' : ''}`}>
                      {error || ''}
                    </div>
                  </div>
                  <button
                    id="submit-button"
                    type="submit"
                    className="btn btn-primary pull-center"
                    disabled={loading}
                  >
                    {loading ? 'Проверка…' : 'Открыть'}
                  </button>
                </form>
                <h3 className="repo_qr_info qr_blue">PIN-код размещается рядом с QR-кодом документа</h3>
              </div>
              <div className="col-md-6 vcenter">
                <img src="/first-page/images/pin_code_document.jpg" style={{ margin: '0 auto', display: 'block' }} alt="PIN code document" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="footer">
        <div>
          <p className="pull-center">© <a href="http://uzinfocom.uz/" target="_blank" rel="noopener noreferrer">UZINFOCOM</a> 2025</p>
          <p className="pull-right">Работает на <a href="http://www.yiiframework.com/" rel="external">Yii Framework</a></p>
        </div>
      </footer>
      <Script src="/first-page/js/jquery.min.js" strategy="afterInteractive" />
      <Script src="/first-page/js/bootstrap.min.js" strategy="afterInteractive" />
      <Script src="/first-page/js/yii.min.js" strategy="afterInteractive" />
      <Script src="/first-page/js/jquery.inputmask.bundle.js" strategy="afterInteractive" />
      <Script src="/first-page/js/yii.captcha.min.js" strategy="afterInteractive" />
      <Script src="/first-page/js/yii.activeForm.min.js" strategy="afterInteractive" />
      <Script id="init-scripts" strategy="afterInteractive">
        {`
          if (typeof jQuery !== 'undefined') {
            jQuery(function ($) {
              jQuery('#w0').alert();
              var inputmask_fea305f5 = {"mask":"9999"};
              jQuery("#repopinmodel-pin_code").inputmask(inputmask_fea305f5);
            });
          }
        `}
      </Script>
    </>
  )
}

