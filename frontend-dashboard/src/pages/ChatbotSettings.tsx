import { useEffect, useState, useRef, FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { chatbotsApi, Chatbot, ChatbotDocument, ChatbotStats } from '../api/chatbots'

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

type Tab = 'config' | 'knowledge' | 'guardrails' | 'stats'

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ChatbotSettings() {
  const { id } = useParams<{ id: string }>()
  const chatbotId = Number(id)

  const [tab, setTab] = useState<Tab>('config')
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)

  // Config tab state
  const [name, setName] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [themeColor, setThemeColor] = useState('#6366f1')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [configError, setConfigError] = useState('')

  // Knowledge base tab state
  const [docs, setDocs] = useState<ChatbotDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [deletingDoc, setDeletingDoc] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Guardrails tab state
  const [guardrailsEnabled, setGuardrailsEnabled] = useState(false)
  const [blockedKeywords, setBlockedKeywords] = useState('')
  const [allowedTopics, setAllowedTopics] = useState('')
  const [offTopicMessage, setOffTopicMessage] = useState('')
  const [savingGuardrails, setSavingGuardrails] = useState(false)
  const [savedGuardrails, setSavedGuardrails] = useState(false)

  // Stats tab state
  const [stats, setStats] = useState<ChatbotStats | null>(null)

  useEffect(() => {
    chatbotsApi.get(chatbotId).then(bot => {
      setChatbot(bot)
      setName(bot.name)
      setWelcomeMessage(bot.welcome_message)
      setSystemPrompt(bot.system_prompt)
      setThemeColor(bot.theme_color)
      setGuardrailsEnabled(bot.guardrails_enabled)
      setBlockedKeywords(bot.blocked_keywords)
      setAllowedTopics(bot.allowed_topics)
      setOffTopicMessage(bot.off_topic_message)
    })
  }, [chatbotId])

  useEffect(() => {
    if (tab === 'knowledge') loadDocs()
    if (tab === 'stats') loadStats()
  }, [tab])

  const loadDocs = async () => {
    setDocsLoading(true)
    try {
      setDocs(await chatbotsApi.listDocuments(chatbotId))
    } finally {
      setDocsLoading(false)
    }
  }

  const loadStats = async () => {
    setStats(await chatbotsApi.getStats(chatbotId))
  }

  const handleSaveConfig = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setConfigError('')
    try {
      const updated = await chatbotsApi.update(chatbotId, {
        name, welcome_message: welcomeMessage,
        system_prompt: systemPrompt, theme_color: themeColor,
      })
      setChatbot(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setConfigError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveGuardrails = async (e: FormEvent) => {
    e.preventDefault()
    setSavingGuardrails(true)
    setSavedGuardrails(false)
    try {
      await chatbotsApi.update(chatbotId, {
        guardrails_enabled: guardrailsEnabled,
        blocked_keywords: blockedKeywords,
        allowed_topics: allowedTopics,
        off_topic_message: offTopicMessage,
      })
      setSavedGuardrails(true)
      setTimeout(() => setSavedGuardrails(false), 2000)
    } finally {
      setSavingGuardrails(false)
    }
  }

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg('')
    setUploadError('')
    try {
      const doc = await chatbotsApi.uploadDocument(chatbotId, file)
      setUploadMsg(`"${doc.filename}" uploaded successfully.`)
      if (fileRef.current) fileRef.current.value = ''
      loadDocs()
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!confirm('Delete this document and all its embeddings?')) return
    setDeletingDoc(docId)
    try {
      await chatbotsApi.deleteDocument(chatbotId, docId)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } finally {
      setDeletingDoc(null)
    }
  }

  if (!chatbot) return <div className="p-8 text-gray-400">Loading…</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'config', label: 'Configuration' },
    { key: 'knowledge', label: 'Knowledge Base' },
    { key: 'guardrails', label: 'Guardrails' },
    { key: 'stats', label: 'Stats & API' },
  ]

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{chatbot.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">Chatbot Settings</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Link
            to={`/dashboard/chatbot/${chatbotId}/conversations`}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            💬 Chats
          </Link>
          <Link
            to={`/dashboard/chatbot/${chatbotId}/embed`}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100"
          >
            {'</>'} Embed Code
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Configuration ───────────────────────────────────────────── */}
      {tab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          {configError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{configError}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Welcome Message</label>
            <input
              type="text" value={welcomeMessage} onChange={e => setWelcomeMessage(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
            <textarea
              rows={5} value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Defines the chatbot's personality and behavior.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme Color</label>
            <div className="flex gap-3 items-center">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setThemeColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    themeColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-0"
              />
              <span className="text-sm text-gray-500 font-mono">{themeColor}</span>
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </form>
      )}

      {/* ── Knowledge Base ──────────────────────────────────────────── */}
      {tab === 'knowledge' && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Upload Document</h2>
              <p className="text-sm text-gray-500 mt-1">
                PDF, TXT, MD or JSON. Files are chunked and embedded for RAG retrieval.
              </p>
            </div>
            <div className="flex gap-3">
              <input
                ref={fileRef} type="file" accept=".pdf,.txt,.md,.json"
                className="flex-1 text-sm text-gray-600 file:mr-3 file:py-2 file:px-4
                           file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700
                           hover:file:bg-indigo-100 file:cursor-pointer"
              />
              <button onClick={handleUpload} disabled={uploading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            {uploadMsg && <p className="text-sm text-green-600">{uploadMsg}</p>}
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          </div>

          {/* Document list */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Documents</h2>
            {docsLoading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : docs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-sm">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map(doc => (
                  <div key={doc.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50"
                  >
                    <div className="text-2xl">
                      {doc.content_type === 'application/pdf' ? '📕' : '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doc.filename}</p>
                      <p className="text-xs text-gray-400">
                        {formatBytes(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={deletingDoc === doc.id}
                      className="text-red-400 hover:text-red-600 text-sm px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingDoc === doc.id ? '…' : 'Delete'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Guardrails ──────────────────────────────────────────────── */}
      {tab === 'guardrails' && (
        <form onSubmit={handleSaveGuardrails} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900">Guardrails</h2>
            <p className="text-sm text-gray-500 mt-1">
              Control what topics the chatbot will and won't respond to.
            </p>
          </div>

          {/* Enable toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800 text-sm">Enable Guardrails</p>
              <p className="text-xs text-gray-400 mt-0.5">
                When off, the chatbot answers everything.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGuardrailsEnabled(v => !v)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                guardrailsEnabled ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                guardrailsEnabled ? 'translate-x-5' : ''
              }`} />
            </button>
          </div>

          <div className={guardrailsEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Blocked Keywords
                </label>
                <input
                  type="text" value={blockedKeywords}
                  onChange={e => setBlockedKeywords(e.target.value)}
                  placeholder="competitor, refund, cancel, ..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Comma-separated. Messages containing these words are blocked instantly.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed Topics
                </label>
                <textarea
                  rows={3} value={allowedTopics}
                  onChange={e => setAllowedTopics(e.target.value)}
                  placeholder="product support, billing questions, shipping information..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Describe what topics are allowed. Injected into the system prompt to guide the AI.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Off-Topic Response
                </label>
                <textarea
                  rows={2} value={offTopicMessage}
                  onChange={e => setOffTopicMessage(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sent when a blocked keyword is detected.
                </p>
              </div>
            </div>
          </div>

          <button type="submit" disabled={savingGuardrails}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {savingGuardrails ? 'Saving…' : savedGuardrails ? '✓ Saved' : 'Save Guardrails'}
          </button>
        </form>
      )}

      {/* ── Stats & API ─────────────────────────────────────────────── */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Conversations', value: stats?.conversations ?? '—', icon: '💬' },
              { label: 'Messages', value: stats?.messages ?? '—', icon: '✉️' },
              { label: 'Documents', value: stats?.documents ?? '—', icon: '📄' },
              { label: 'Knowledge Chunks', value: stats?.chunks ?? '—', icon: '🧩' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="text-2xl mb-2">{card.icon}</div>
                <div className="text-2xl font-bold text-gray-900">{card.value}</div>
                <div className="text-sm text-gray-500 mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Token usage */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Token Usage</h2>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Input Tokens', value: stats?.input_tokens, color: 'text-blue-600' },
                { label: 'Output Tokens', value: stats?.output_tokens, color: 'text-purple-600' },
                { label: 'Total Tokens', value: stats?.total_tokens, color: 'text-indigo-700' },
              ].map(item => (
                <div key={item.label} className="text-center p-4 bg-gray-50 rounded-xl">
                  <div className={`text-xl font-bold ${item.color}`}>
                    {item.value !== undefined ? item.value.toLocaleString() : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Approximate counts based on character length (~4 chars per token).
            </p>
          </div>

          {/* API info */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">API Reference</h2>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Chatbot ID</p>
              <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800">
                {chatbotId}
              </code>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Get Config (public)
              </p>
              <code className="block bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 break-all">
                GET /api/public/config/{chatbotId}
              </code>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Chat (public · SSE stream)
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 overflow-x-auto">{`POST /api/public/chat
Content-Type: application/json

{
  "chatbot_id": ${chatbotId},
  "message": "Hello!"
}`}</pre>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Embed Snippet
              </p>
              <pre className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm font-mono text-gray-800 overflow-x-auto">{`<script
  src="https://widget.yourdomain.com/widget.js"
  data-chatbot-id="${chatbotId}">
</script>`}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
