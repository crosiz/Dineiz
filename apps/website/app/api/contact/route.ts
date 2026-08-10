import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  restaurantName: z.string().min(2),
  message: z.string().min(10),
  source: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = contactSchema.parse(body);

    const resendApiKey = process.env.RESEND_API_KEY;
    const targetEmail = process.env.CONTACT_EMAIL || "hello@dineiz.com";

    if (resendApiKey) {
      // Dispatch via Resend API
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dineiz Contact Form <noreply@dineiz.com>",
          to: [targetEmail],
          subject: `New Lead: ${data.restaurantName} (${data.name})`,
          html: `
            <h2>New Restaurant Inquiry</h2>
            <p><strong>Name:</strong> ${data.name}</p>
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Phone:</strong> ${data.phone}</p>
            <p><strong>Restaurant:</strong> ${data.restaurantName}</p>
            <p><strong>Source:</strong> ${data.source}</p>
            <p><strong>Message:</strong></p>
            <p>${data.message}</p>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true, message: "Contact request received" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Invalid contact form data" },
      { status: 400 }
    );
  }
}
