import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { chatbotsApi, Chatbot } from '../api/chatbots'

const WIDGET_URL = import.meta.env.VITE_WIDGET_URL ?? 'http://localhost:3002'

export default function EmbedCode() {
  const { id } = useParams<{ id: string }>()
  const chatbotId = Number(id)
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [copied, setCopied] = useState(false)
  const [keyCopied, setKeyCopied] = useState(false)

  useEffect(() => {
    chatbotsApi.get(chatbotId).then(setChatbot)
  }, [chatbotId])

  const embedCode = chatbot
    ? `<script\n  src="${WIDGET_URL}/widget.js"\n  data-api-key="${chatbot.api_key}">\n</script>`
    : ''

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyCopy = () => {
    if (!chatbot) return
    navigator.clipboard.writeText(chatbot.api_key)
    setKeyCopied(true)
    setTimeout(() => setKeyCopied(false), 2000)
  }

  if (!chatbot) return <div className="p-8 text-gray-400">Loading…</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Link
          to={`/dashboard/chatbot/${chatbotId}`}
          className="text-gray-400 hover:text-gray-600"
        >←</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Embed Code</h1>
          <p className="text-gray-500 text-sm mt-0.5">{chatbot.name}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
        <div>
          <h2 className="font-semibold text-gray-900 mb-2">How to embed</h2>
          <p className="text-sm text-gray-500">
            Paste this snippet before the closing{' '}
            <code className="bg-gray-100 px-1 rounded">&lt;/body&gt;</code> tag
            of your website. The chatbot widget will appear as a floating button.
          </p>
        </div>

        <div className="relative">
          <pre className="bg-gray-900 text-green-400 rounded-xl p-5 text-sm font-mono overflow-x-auto whitespace-pre">
            {embedCode}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 text-white text-xs
                       rounded-lg hover:bg-white/20 transition-colors font-medium"
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        {/* API key display */}
        <div className="border border-gray-100 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            API Key
          </p>
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm font-mono text-gray-800 bg-gray-50 rounded-lg px-3 py-2 truncate">
              {chatbot.api_key}
            </code>
            <button
              onClick={handleKeyCopy}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium text-indigo-600
                         bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              {keyCopied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Keep this key private. Use it as the <code className="bg-gray-100 px-1 rounded">data-api-key</code> value in your embed snippet.
          </p>
        </div>

        <div className="border-t border-gray-100 pt-6">
          <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
          <div className="bg-gray-50 rounded-xl p-6 flex items-end justify-end min-h-32 relative">
            <p className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              Your website content here
            </p>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl shadow-lg cursor-pointer"
              style={{ backgroundColor: chatbot.theme_color }}
            >
              💬
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
