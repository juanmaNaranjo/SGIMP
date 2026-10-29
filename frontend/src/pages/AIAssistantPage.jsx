import { useState, useRef, useEffect } from 'react'
import { aiAPI } from '../services/api'
import { Bot, Send, User, Sparkles, Loader2 } from 'lucide-react'
import { PageHeader } from '../components/ui'

const SUGGESTIONS = [
  '¿Qué materias primas vencen esta semana?',
  'Explícame el sistema GHS de clasificación química',
  '¿Son compatibles el hipoclorito de sodio y el ácido cítrico?',
  '¿Qué documentos se requieren para una fragancia?',
  '¿Cómo configuro una alerta de stock mínimo?',
  'Dame recomendaciones para almacenamiento seguro de oxidantes',
]

function ChatBubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-purple-500 to-blue-600'
      }`}>
        {isUser ? <User size={15} className="text-white" /> : <Bot size={15} className="text-white" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
      }`}>
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.suggested_actions?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {msg.suggested_actions.map((action, i) => (
              <span key={i} className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs">
                ✦ {action}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Hola! Soy el asistente SGIMP, especializado en gestión de materias primas químicas y cosméticas. Puedo ayudarte con consultas sobre vencimientos, compatibilidad química, normativas GHS, documentación requerida y mucho más. ¿En qué puedo ayudarte?',
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text) => {
    const userMsg = text || input.trim()
    if (!userMsg || loading) return
    setInput('')

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await aiAPI.chat({ message: userMsg, conversation_history: history })
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.data.response,
        suggested_actions: res.data.suggested_actions,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error al conectar con el asistente. Verifica que ANTHROPIC_API_KEY esté configurado en el backend.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)]">
      <PageHeader
        title="Asistente IA"
        subtitle="Especializado en materias primas, GHS y normativas de calidad"
      />

      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Bot size={15} className="text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-blue-500" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only when few messages) */}
        {messages.length <= 2 && (
          <div className="px-6 pb-3">
            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><Sparkles size={12} /> Sugerencias</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="text-xs bg-gray-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Escribe tu pregunta sobre materias primas, GHS, vencimientos..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              disabled={loading}
            />
            <button
              className="btn-primary px-4"
              onClick={() => send()}
              disabled={!input.trim() || loading}
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Powered by Claude · Especializado en industria cosmética/farmacéutica colombiana
          </p>
        </div>
      </div>
    </div>
  )
}
