import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

// Inizializzazione Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Definizione del Tool che l'IA deve usare per salvare la prenotazione
const tools = [
  {
    type: "function",
    function: {
      name: "create_booking",
      description: "Salva una prenotazione nel database quando l'utente conferma tutti i dati.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Nome e cognome del cliente" },
          customer_email: { type: "string", description: "Email del cliente" },
          customer_phone: { type: "string", description: "Telefono del cliente" },
          date: { type: "string", description: "Data nel formato YYYY-MM-DD" },
          time: { type: "string", description: "Orario scelto (es. 11:00)" },
          guests: { type: "number", description: "Numero di persone" },
          package_name: { type: "string", description: "Nome del pacchetto o esperienza" }
        },
        required: ["customer_name", "customer_email", "date", "time", "guests", "package_name"]
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const { messages, winery_slug } = await req.json();

    // System prompt di sicurezza per la demo
    let systemPrompt = "Sei WineAssistant, un assistente virtuale esperto e accogliente per le degustazioni di vino. Rispondi in modo gentile, professionale e aiuta i clienti a scoprire i nostri vini e a prenotare le visite in cantina.";
    let wineryId = null;

    // Tentativo sicuro di recupero da Supabase senza far bloccare il sito
    try {
      const { data: winery } = await supabase
        .from('wineries')
        .select('*')
        .eq('slug', winery_slug || 'collio-demo')
        .maybeSingle();

      if (winery) {
        if (winery.system_prompt) systemPrompt = winery.system_prompt;
        if (winery.id) wineryId = winery.id;
      }
    } catch (dbErr) {
      console.log("Supabase fetch bypassato, uso prompt predefinito:", dbErr);
    }

    // 2. Chiamata a Groq con supporto ai Tools
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages
      ],
      tools: tools as any,
      tool_choice: "auto"
    });

    const responseMessage = completion.choices[0].message;

    // 3. Controlla se Groq ha deciso di chiamare il Tool di prenotazione
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      if (toolCall.function.name === "create_booking") {
        const args = JSON.parse(toolCall.function.arguments);

        // Tentativo di salvataggio su Supabase (non bloccante)
        try {
          await supabase
            .from('bookings')
            .insert([
              {
                winery_id: wineryId,
                customer_name: args.customer_name,
                customer_email: args.customer_email,
                customer_phone: args.customer_phone || '',
                booking_date: args.date,
                booking_time: args.time,
                guests_count: args.guests,
                package_name: args.package_name
              }
            ]);
        } catch (saveErr) {
          console.error("Errore salvataggio prenotazione (non bloccante):", saveErr);
        }

        return NextResponse.json({
          role: "assistant",
          content: `Perfetto ${args.customer_name}! Ho registrato la tua prenotazione per **${args.package_name}** in data **${args.date}** alle **${args.time}** per **${args.guests} persone**.`
        });
      }
    }

    // Risposta standard
    return NextResponse.json({
      role: "assistant",
      content: responseMessage.content
    });

  } catch (error) {
    console.error("Errore API Chat:", error);
    return NextResponse.json({ error: "Errore durante l'elaborazione" }, { status: 500 });
  }
}
