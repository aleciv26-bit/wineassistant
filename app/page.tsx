'use client';

import { useState } from 'react';

export default function Home() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          winery_slug: 'collio-demo'
        }),
      });

      const data = await res.json();

      if (data && data.content) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Si è verificato un piccolo problema, riprova tra poco.' }
        ]);
      }
    } catch (err) {
      console.error("Errore fetch client:", err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Impossibile connettersi al server.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-800 flex items-center justify-center text-xl">
            🍷
          </div>
          <div>
            <h1 className="font-bold text-lg">WineAssistant</h1>
            <p className="text-xs text-slate-400">Assistente virtuale per la tua cantina</p>
          </div>
        </div>
      </header>

      {/* Chat Container */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 my-10">
            Fai una domanda a WineAssistant su degustazioni, vini o orari!
          </div>
        )}
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-2xl ${
                m.role === 'user'
                  ? 'bg-red-900 text-white rounded-br-none'
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 p-3 rounded-2xl text-slate-400 animate-pulse">
              WineAssistant sta digitando...
            </div>
          </div>
        )}
      </main>

      {/* Input Form */}
      <footer className="p-4 bg-slate-800 border-t border-slate-700">
        <form onSubmit={sendMessage} className="max-w-3xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-medium transition"
          >
            Invia
          </button>
        </form>
      </footer>
    </div>
  );
}
