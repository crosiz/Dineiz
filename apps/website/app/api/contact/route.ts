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
      // 1. Send internal lead notification
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dineiz Contact Form <noreply@dineiz.com>",
          to: [targetEmail, "rafaykhan2k19@gmail.com"],
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

      // 2. Send auto-reply to the customer
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dineiz Team <hello@dineiz.com>",
          to: [data.email],
          subject: "Thank you for contacting Dineiz",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px 20px; border-radius: 12px; border: 1px solid #eaeaea;">
              <h2 style="color: #1d1d1f; margin-bottom: 24px; font-size: 24px; letter-spacing: -0.5px;">Thank you for reaching out.</h2>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hi <strong>${data.name}</strong>,
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                We have received your inquiry regarding <strong>${data.restaurantName}</strong>. Our team is currently reviewing your message and will contact you shortly to answer your questions or schedule a personalized demo.
              </p>
              <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 40px;">
                In the meantime, feel free to reply directly to this email if you have any immediate questions.
              </p>
              
              <div style="border-top: 1px solid #eaeaea; padding-top: 30px; margin-top: 30px;">
                <p style="margin: 0; color: #888888; font-size: 14px;">Best regards,</p>
                <div style="margin-top: 10px;">
                  <span style="color: #FF6B35; font-size: 24px; font-weight: 900; letter-spacing: -1px;">Dineiz</span>
                </div>
                <p style="margin-top: 5px; color: #aaaaaa; font-size: 12px;">
                  The operating system for modern restaurants in Pakistan.
                </p>
              </div>
            </div>
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
