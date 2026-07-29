import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const { message, history = [], winerySlug = "collio-demo" } = await req.json();

    if (!message) {
      return NextResponse.json(
        { error: "Messaggio mancante." },
        { status: 400 }
      );
    }

    // 1. Recupera i dati della cantina da Supabase
    const { data: winery, error: wineryError } = await supabase
      .from("wineries")
      .select("*")
      .eq("slug", winerySlug)
      .single();

    if (wineryError || !winery) {
      return NextResponse.json(
        { error: "Cantina non trovata." },
        { status: 404 }
      );
    }

    // 2. Costruisci il prompt di sistema
    const systemContent = `${winery.system_prompt || "Sei un sommelier ed esperto di accoglienza per questa cantina."}

Dati e pacchetti della cantina:
${JSON.stringify(winery.tasting_packages || {}, null, 2)}

Rispondi in modo professionale, amichevole e nella stessa lingua usata dal cliente.`;

    // 3. Prepara lo storico messaggi
    const messages = [
      { role: "system", content: systemContent },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // 4. Chiamata a Groq API
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: messages as any,
    });

    const reply = completion.choices[0]?.message?.content || "Scusa, si è verificato un errore.";

    return NextResponse.json({ message: reply });
  } catch (err: any) {
    console.error("[chat] Error:", err);
    return NextResponse.json(
      { error: err.message || "Errore del server" },
      { status: 500 }
    );
  }
}