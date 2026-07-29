"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
};

const DEMO_WINERIES = [
  { slug: "collio-demo", label: "Collio Demo" },
] as const;

function formatMessage(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j}>{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        )}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    );
  });
}

export default function Home() {
  const [winerySlug, setWinerySlug] = useState<string>(DEMO_WINERIES[0].slug);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    const history = messages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winerySlug, message: trimmed, history }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Errore durante la richiesta.");
      }

      const botMessage: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        content: data.message,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Si è verificato un errore.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-full flex-1 flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-[#2a1215]">
      <header className="border-b border-white/10 bg-black/20 px-4 py-4 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#722F37] text-lg shadow-lg shadow-[#722F37]/30">
              🍷
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">
                WineBot
              </h1>
              <p className="text-sm text-slate-400">
                Assistente virtuale per la tua cantina
              </p>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm text-slate-300 sm:items-end">
            <span className="text-xs uppercase tracking-wider text-slate-500">
              Cantina
            </span>
            <select
              value={winerySlug}
              onChange={(e) => {
                setWinerySlug(e.target.value);
                setMessages([]);
                setError(null);
              }}
              className="rounded-lg border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white outline-none ring-[#722F37]/50 transition focus:ring-2"
            >
              {DEMO_WINERIES.map((w) => (
                <option key={w.slug} value={w.slug}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 shadow-2xl shadow-black/40 backdrop-blur-sm">
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {messages.length === 0 && !isLoading && (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
                <div className="rounded-full bg-[#722F37]/20 px-4 py-2 text-sm text-[#e8b4b8]">
                  Cantina demo: {winerySlug}
                </div>
                <p className="max-w-sm text-slate-400">
                  Scrivi un messaggio per iniziare la conversazione. Prova con
                  &ldquo;Ciao&rdquo; o &ldquo;Quali pacchetti di degustazione
                  offrite?&rdquo;
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] sm:text-base ${
                    msg.role === "user"
                      ? "rounded-br-md bg-[#722F37] text-white shadow-lg shadow-[#722F37]/20"
                      : "rounded-bl-md border border-white/5 bg-slate-800/90 text-slate-100"
                  }`}
                >
                  {msg.role === "bot" ? formatMessage(msg.content) : msg.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md border border-white/5 bg-slate-800/90 px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#722F37] [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#722F37] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#722F37] [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div className="mx-4 mb-2 rounded-lg border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-300 sm:mx-6">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/10 p-4 sm:p-6"
          >
            <div className="flex gap-2 sm:gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi un messaggio..."
                disabled={isLoading}
                className="flex-1 rounded-xl border border-white/10 bg-slate-800/80 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-[#722F37]/50 focus:ring-2 focus:ring-[#722F37]/30 disabled:opacity-50 sm:text-base"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-[#722F37] px-5 py-3 text-sm font-medium text-white shadow-lg shadow-[#722F37]/25 transition hover:bg-[#5c262d] disabled:cursor-not-allowed disabled:opacity-50 sm:px-6 sm:text-base"
              >
                Invia
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
