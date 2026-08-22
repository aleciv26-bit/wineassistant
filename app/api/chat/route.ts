// Inserimento dinamico con fallback per il nome della colonna
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

        // Se 'package_name' non esiste su Supabase, prova con 'experience_name'
        if (insertError && insertError.message.includes("package_name")) {
          delete bookingPayload.package_name;
          bookingPayload.experience_name = args.package_name;

          const retry = await supabase
            .from('bookings')
            .insert([bookingPayload])
            .select();

          insertData = retry.data;
          insertError = retry.error;
        }

        if (insertError) {
          console.error("❌ ERRORE SUPABASE INSERT:", insertError);
          return NextResponse.json({
            role: "assistant",
            content: `Ho provato a registrare la prenotazione ma si è verificato un errore nel database: ${insertError.message}`
          });
        }
