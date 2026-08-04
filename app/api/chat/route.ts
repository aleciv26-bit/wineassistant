import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
//import { Resend } from 'resend';

// Inizializzazione Client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Usa la service role key per poter scrivere
);
//const resend = new Resend(process.env.RESEND_API_KEY);

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

    // 1. Recupera i dati della cantina da Supabase in base allo slug
    const { data: winery } = await supabase
      .from('wineries')
      .select('*')
      .eq('slug', winery_slug || 'collio-demo')
      .single();

    const systemPrompt = winery?.system_prompt || "Sei un assistente per le degustazioni di vino.";

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

        // A. Salva su Supabase nella tabella 'bookings'
        const { error: dbError } = await supabase
          .from('bookings')
          .insert([
            {
              winery_id: winery?.id,
              customer_name: args.customer_name,
              customer_email: args.customer_email,
              customer_phone: args.customer_phone || '',
              booking_date: args.date,
              booking_time: args.time,
              guests_count: args.guests,
              package_name: args.package_name
            }
          ]);

        if (dbError) {
          console.error("Errore salvataggio Supabase:", dbError);
        } else {
          // B. Invia l'email al cliente con Resend
          if (process.env.RESEND_API_KEY) {
            await resend.emails.send({
              from: 'WineBot <onboarding@resend.dev>', // In produzione metterai il tuo dominio
              to: args.customer_email,
              subject: `🍷 Conferma Prenotazione - ${winery?.name || 'Cantina'}`,
              html: `
                <h2>Prenotazione Confermata!</h2>
                <p>Ciao <b>${args.customer_name}</b>, ti aspettiamo presso <b>${winery?.name}</b>!</p>
                <ul>
                  <li><b>Esperienza:</b> ${args.package_name}</li>
                  <li><b>Data:</b> ${args.date}</li>
                  <li><b>Ora:</b> ${args.time}</li>
                  <li><b>Persone:</b> ${args.guests}</li>
                </ul>
                <p>A presto!</p>
              `
            });
          }
        }

        return NextResponse.json({
          role: "assistant",
          content: `Perfetto ${args.customer_name}! Ho registrato la tua prenotazione per **${args.package_name}** in data **${args.date}** alle **${args.time}** per **${args.guests} persone**. Ti abbiamo inviato una mail di conferma all'indirizzo **${args.customer_email}**.`
        });
      }
    }

    // Se è una normale risposta di testo
    return NextResponse.json({
      role: "assistant",
      content: responseMessage.content
    });

  } catch (error) {
    console.error("Errore API Chat:", error);
    return NextResponse.json({ error: "Errore durante l'elaborazione" }, { status: 500 });
  }
}
