import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { chatbotsApi } from '../api/chatbots'

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function CreateChatbot() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [welcomeMessage, setWelcomeMessage] = useState('Hello! How can I help you today?')
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.')
  const [themeColor, setThemeColor] = useState('#6366f1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const bot = await chatbotsApi.create({
        name,
        welcome_message: welcomeMessage,
        system_prompt: systemPrompt,
        theme_color: themeColor,
      })
      navigate(`/dashboard/chatbot/${bot.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create chatbot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Create Chatbot</h1>
        <p className="text-gray-500 mt-1">Configure your new AI chatbot</p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-white rounded-2xl border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chatbot Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Support Bot, Sales Assistant"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Welcome Message
          </label>
          <input
            type="text"
            value={welcomeMessage}
            onChange={e => setWelcomeMessage(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            System Prompt
          </label>
          <textarea
            rows={4}
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="Instructions for how the chatbot should behave…"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Theme Color
          </label>
          <div className="flex gap-3">
            {COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setThemeColor(c)}
                className={`w-8 h-8 rounded-full transition-transform ${
                  themeColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={themeColor}
              onChange={e => setThemeColor(e.target.value)}
              className="w-8 h-8 rounded-full cursor-pointer border-0"
              title="Custom color"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium
                       hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Chatbot'}
          </button>
        </div>
      </form>
    </div>
  )
}
