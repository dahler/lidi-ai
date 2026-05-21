import { useEffect, useState } from 'react'
import ChatWidget from './components/ChatWidget'

interface ChatbotConfig {
  id: number
  name: string
  welcome_message: string
  theme_color: string
}

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function App() {
  // api_key comes from the URL: /chatbot/bot_abc123?host=https%3A%2F%2Fexample.com
  const apiKey = decodeURIComponent(location.pathname.split('/').pop() ?? '')
  const hostOrigin = new URLSearchParams(location.search).get('host') ?? ''
  const [config, setConfig] = useState<ChatbotConfig | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!apiKey) return
    fetch(`${API_BASE}/api/public/config/${encodeURIComponent(apiKey)}`)
      .then(r => {
        if (!r.ok) throw new Error(`Chatbot not found (${r.status})`)
        return r.json()
      })
      .then(setConfig)
      .catch(e => setError(e.message ?? 'Failed to load chatbot'))
  }, [apiKey])

  if (!apiKey)
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        No API key specified.
      </div>
    )

  if (error)
    return (
      <div className="h-screen flex items-center justify-center text-red-400">
        {error}
      </div>
    )

  if (!config)
    return (
      <div className="h-screen flex items-center justify-center text-gray-400">
        Loading…
      </div>
    )

  return <ChatWidget config={config} apiBase={API_BASE} apiKey={apiKey} hostOrigin={hostOrigin} />
}
