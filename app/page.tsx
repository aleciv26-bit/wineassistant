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
          { role: 'assistant', content: 'Si è verificato un errore nel recupero della risposta.' }
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Errore di connessione al server.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Messages Scroll Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-400 my-8 text-sm px-4">
            <span className="text-3xl block mb-2">🍷</span>
            Ciao! Sono l'assistente virtuale della cantina. Come posso aiutarti oggi?
          </div>
        )}
        
        {messages.map((m, index) => (
          <div
            key={index}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-rose-900 text-amber-50 rounded-br-none shadow'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none shadow-md'
              }`}
            >
              {/* whitespace-pre-wrap mantiene i ritorni a capo e gli elenchi puntati */}
              <div className="whitespace-pre-wrap break-words">
                {m.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl text-xs text-rose-300 animate-pulse flex items-center gap-2">
              <span>🍷</span> WineAssistant sta scrivendo...
            </div>
          </div>
        )}
      </main>

      {/* Input Form */}
      <footer className="p-3 bg-slate-900/90 border-t border-slate-800">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-800 transition"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-rose-900 hover:bg-rose-800 disabled:opacity-50 text-amber-100 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow cursor-pointer"
          >
            Invia
          </button>
        </form>
      </footer>
    </div>
  );
}
