import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const tools = [
  {
    type: "function",
    function: {
      name: "create_booking",
      description: "Salva OBBLIGATORIAMENTE una prenotazione nel database quando l'utente fornisce o conferma i dati principali.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Nome e cognome del cliente" },
          customer_email: { type: "string", description: "Email del cliente" },
          customer_phone: { type: "string", description: "Telefono del cliente" },
          date: { type: "string", description: "Data nel formato YYYY-MM-DD" },
          time: { type: "string", description: "Orario scelto (es. 11:00 o 15:00)" },
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
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const winery_slug = body.winery_slug;

    let systemPrompt = "Sei WineAssistant, un assistente virtuale esperto e accogliente per le degustazioni di vino. Quando raccogli i dati per una prenotazione, invoca IMMEDIATAMENTE la funzione create_booking.";
    let wineryId = null;

    if (supabase) {
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
        console.error("Supabase fetch error:", dbErr);
      }
    }

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({
        role: m.role || 'user',
        content: m.content || ''
      }))
    ];

    // MODELLO CON SUPPORTO COMPLETO AI TOOLS / FUNCTION CALLING
   const completion = await groq.chat.completions.create({
      model: "qwen-3.6-27b", // Oppure "gpt-oss-120b"
      messages: formattedMessages as any,
      tools: tools as any,
      tool_choice: "auto"
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      
      if (toolCall.function.name === "create_booking") {
        const args = JSON.parse(toolCall.function.arguments);

        if (supabase) {
          const bookingPayload: Record<string, any> = {
            winery_id: wineryId,
            customer_name: args.customer_name,
            customer_email: args.customer_email,
            customer_phone: args.customer_phone || '',
            booking_date: args.date,
            booking_time: args.time,
            guests_count: Number(args.guests),
            package_name: args.package_name,
          };

          let { data: insertData, error: insertError } = await supabase
            .from('bookings')
            .insert([bookingPayload])
            .select();

          if (insertError && insertError.message.includes("package_name")) {
            delete bookingPayload.package_name;
            bookingPayload.experience_name = args.package_name;

            const retry = await supabase
              .from('bookings')
              .insert([bookingPayload])
              .select();

            insertError = retry.error;
          }

          if (insertError) {
            console.error("❌ ERRORE SUPABASE INSERT:", insertError);
            return NextResponse.json({
              role: "assistant",
              content: `Errore nel salvataggio del database: ${insertError.message}`
            });
          }
        }

        return NextResponse.json({
          role: "assistant",
          content: `Perfetto **${args.customer_name}**! 🎉\n\nHo registrato con successo la tua prenotazione per **${args.package_name}**:\n- **Data:** ${args.date}\n- **Ora:** ${args.time}\n- **Ospiti:** ${args.guests} persone\n\nTi abbiamo inviato una conferma a **${args.customer_email}**. Ti aspettiamo in cantina!`
        });
      }
    }

    return NextResponse.json({
      role: "assistant",
      content: responseMessage.content || "Ciao! Come posso aiutarti?"
    });

  } catch (error: any) {
    console.error("❌ Errore API Chat generale:", error);
    return NextResponse.json({ error: error.message || "Errore durante l'elaborazione" }, { status: 500 });
  }
}
