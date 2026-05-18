import { useState, useRef, useEffect, KeyboardEvent } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  streaming?: boolean
}

interface Config {
  id: number
  name: string
  welcome_message: string
  theme_color: string
}

interface Props {
  config: Config
  apiBase: string
  apiKey: string
  hostOrigin: string
}

// ── Lightweight markdown renderer ──────────────────────────────────────────

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let m: RegExpExecArray | null
  let key = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={key++} className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>)
    }
    last = m.index + token.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function MarkdownMessage({ content, accentColor }: { content: string; accentColor: string }) {
  const lines = content.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push(
        <div key={key++} className="my-2">
          {lang && (
            <div className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-t-lg font-mono">
              {lang}
            </div>
          )}
          <pre className={`bg-gray-800 text-gray-100 text-xs font-mono p-3 overflow-x-auto ${lang ? 'rounded-b-lg' : 'rounded-lg'}`}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        </div>
      )
      i++
      continue
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]
      const cls = level === 1
        ? 'text-base font-bold mt-3 mb-1'
        : level === 2
        ? 'text-sm font-bold mt-2 mb-1'
        : 'text-sm font-semibold mt-2 mb-0.5'
      nodes.push(<div key={key++} className={cls}>{renderInline(text)}</div>)
      i++
      continue
    }

    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={key++} className="border-current/20 my-2" />)
      i++
      continue
    }

    if (/^[-*]\s/.test(line)) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(
          <li key={i} className="flex gap-2 items-start">
            <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-50" />
            <span className="flex-1">{renderInline(lines[i].replace(/^[-*]\s/, ''))}</span>
          </li>
        )
        i++
      }
      nodes.push(<ul key={key++} className="space-y-1.5 my-2 ml-1">{items}</ul>)
      continue
    }

    if (/^\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = []
      let num = 1
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(
          <li key={i} className="flex gap-2.5 items-start">
            <span
              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 text-white"
              style={{ backgroundColor: accentColor }}
            >
              {num}
            </span>
            <span className="flex-1 pt-0.5">{renderInline(lines[i].replace(/^\d+\.\s/, ''))}</span>
          </li>
        )
        i++
        num++
      }
      nodes.push(<ol key={key++} className="space-y-2 my-2 ml-1">{items}</ol>)
      continue
    }

    if (line.trim() === '') {
      if (nodes.length > 0) nodes.push(<div key={key++} className="h-2" />)
      i++
      continue
    }

    nodes.push(
      <p key={key++} className="leading-relaxed">{renderInline(line)}</p>
    )
    i++
  }

  return <div className="text-sm space-y-0.5">{nodes}</div>
}

// ── Main widget component ──────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'lidi_conv_'

export default function ChatWidget({ config, apiBase, apiKey, hostOrigin }: Props) {
  const storageKey = STORAGE_KEY_PREFIX + apiKey

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: config.welcome_message },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationUuid, setConversationUuid] = useState<string | null>(
    () => localStorage.getItem(storageKey)
  )
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    setMessages(prev => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }])

    try {
      const res = await fetch(`${apiBase}/api/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          message: text,
          conversation_uuid: conversationUuid,
          host_origin: hostOrigin || undefined,
        }),
      })

      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const raw = decoder.decode(value, { stream: true })
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          try {
            const parsed = JSON.parse(payload)
            if (parsed && typeof parsed === 'object' && parsed.type === 'meta') {
              const uuid = parsed.conversation_uuid as string
              localStorage.setItem(storageKey, uuid)
              setConversationUuid(uuid)
              continue
            }
            accumulated += parsed
          } catch {
            accumulated += payload
          }
        }
        setMessages(prev => {
          const next = [...prev]
          next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: true }
          return next
        })
      }

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: 'assistant', content: accumulated, streaming: false }
        return next
      })
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          streaming: false,
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 text-white shadow-sm flex-shrink-0"
        style={{ backgroundColor: config.theme_color }}
      >
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-lg flex-shrink-0">
          🤖
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight">{config.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 flex-shrink-0" />
            <p className="text-xs text-white/80">{loading ? 'Typing…' : 'Online'}</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0 mt-1"
                style={{ backgroundColor: config.theme_color }}
              >
                🤖
              </div>
            )}

            <div
              className={`max-w-[82%] px-4 py-3 rounded-2xl shadow-sm ${
                msg.role === 'user'
                  ? 'text-white rounded-tr-sm text-sm leading-relaxed'
                  : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'
              }`}
              style={msg.role === 'user' ? { backgroundColor: config.theme_color } : {}}
            >
              {msg.role === 'assistant' ? (
                msg.content ? (
                  <>
                    <MarkdownMessage content={msg.content} accentColor={config.theme_color} />
                    {msg.streaming && (
                      <span className="inline-block w-0.5 h-3.5 ml-0.5 bg-gray-400 animate-pulse rounded-full align-middle" />
                    )}
                  </>
                ) : (
                  <span className="flex gap-1 items-center h-5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )
              ) : (
                msg.content
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0 mt-1">
                👤
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-200 bg-white flex-shrink-0">
        <div
          className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-2xl px-3 py-2 focus-within:ring-2 transition-all"
          style={{ '--tw-ring-color': config.theme_color + '40' } as React.CSSProperties}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder="Type a message…"
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400
                       focus:outline-none disabled:opacity-50 py-1 max-h-28 leading-relaxed"
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white
                       transition-all disabled:opacity-30 flex-shrink-0 mb-0.5 hover:opacity-90 active:scale-95"
            style={{ backgroundColor: config.theme_color }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
        <p className="text-center text-xs text-gray-300 mt-2">Powered by Lidi AI</p>
      </div>
    </div>
  )
}
