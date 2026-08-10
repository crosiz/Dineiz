import { NextResponse } from "next/server";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = newsletterSchema.parse(body);

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Dineiz Blog <newsletter@dineiz.com>",
          to: [email],
          subject: "Welcome to Dineiz Restaurant Guides & Growth Tips",
          html: `
            <h2>Welcome to Dineiz!</h2>
            <p>Thank you for subscribing to our weekly Pakistani restaurant management guide.</p>
            <p>You will receive operational tips, FBR tax updates, and revenue growth strategies straight to your inbox.</p>
          `,
        }),
      });
    }

    return NextResponse.json({ success: true, message: "Subscribed to newsletter" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Invalid email" },
      { status: 400 }
    );
  }
}
