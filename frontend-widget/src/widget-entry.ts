/**
 * widget-entry.ts — standalone embed script (built as widget.js)
 *
 * Usage on customer websites:
 *   <script src="https://widget.example.com/widget.js" data-api-key="bot_…"></script>
 *
 * Architecture: creates a floating button that opens a sandboxed iframe.
 * The iframe loads the full React chat UI from the widget origin, so CSS
 * and JavaScript are fully isolated from the host page.
 */
;(function () {
  const script = document.currentScript as HTMLScriptElement | null
  const apiKey = script?.getAttribute('data-api-key')
  if (!apiKey) {
    console.warn('[Lidi Widget] data-api-key attribute is missing.')
    return
  }

  // Derive widget origin from the script src
  const scriptSrc = script?.src ?? ''
  const widgetOrigin = scriptSrc
    ? new URL(scriptSrc).origin
    : 'http://localhost:3002'

  // ── Styles ────────────────────────────────────────────────────────
  const style = document.createElement('style')
  style.textContent = `
    #lidi-widget-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #6366f1;
      color: #fff;
      font-size: 24px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 999998;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #lidi-widget-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 24px rgba(0,0,0,0.25);
    }
    #lidi-widget-container {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 600px;
      max-height: calc(100vh - 120px);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      z-index: 999999;
      display: none;
      border: 1px solid rgba(0,0,0,0.08);
    }
    #lidi-widget-frame {
      width: 100%;
      height: 100%;
      border: none;
    }
    @media (max-width: 480px) {
      #lidi-widget-container {
        bottom: 0;
        right: 0;
        width: 100%;
        height: 100%;
        border-radius: 0;
        max-height: 100%;
      }
      #lidi-widget-btn {
        bottom: 16px;
        right: 16px;
      }
    }
  `
  document.head.appendChild(style)

  // ── Floating button ───────────────────────────────────────────────
  const btn = document.createElement('button')
  btn.id = 'lidi-widget-btn'
  btn.setAttribute('aria-label', 'Open chat')
  btn.innerHTML = '💬'
  document.body.appendChild(btn)

  // ── iframe container ──────────────────────────────────────────────
  const container = document.createElement('div')
  container.id = 'lidi-widget-container'

  const iframe = document.createElement('iframe')
  iframe.id = 'lidi-widget-frame'
  iframe.title = 'Chat widget'
  iframe.allow = 'microphone'
  iframe.setAttribute('loading', 'lazy')

  container.appendChild(iframe)
  document.body.appendChild(container)

  // ── Toggle logic ──────────────────────────────────────────────────
  let open = false
  let loaded = false

  btn.addEventListener('click', () => {
    open = !open
    container.style.display = open ? 'block' : 'none'
    btn.innerHTML = open ? '✕' : '💬'
    btn.setAttribute('aria-label', open ? 'Close chat' : 'Open chat')

    if (open && !loaded) {
      const host = encodeURIComponent(window.location.origin)
      iframe.src = `${widgetOrigin}/chatbot/${encodeURIComponent(apiKey)}?host=${host}`
      loaded = true
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) btn.click()
  })
})()
