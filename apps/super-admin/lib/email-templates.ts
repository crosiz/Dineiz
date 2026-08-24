/**
 * Dineiz Platform — Premium Onboarding Email Template
 */

export interface WelcomeEmailData {
  restaurantName: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  plan: string;
  billingCycle: string;
  trialDays?: number;
  trialEndsAt?: Date | string | null;
  branches: { branchName: string; code: string }[];
  loginUrl?: string;
}

export function generateWelcomeEmailHtml(data: WelcomeEmailData): string {
  const loginUrl = data.loginUrl || 'https://console.dineiz.com';
  const trialText =
    data.trialDays && Number(data.trialDays) > 0
      ? `${data.trialDays}-Day Free Trial (Full Access)`
      : 'Active Subscription';

  const branchItems = data.branches
    .map(
      (b) => `
      <tr style="border-bottom: 1px solid #334155;">
        <td style="padding: 12px 16px; color: #f8fafc; font-size: 13px; font-weight: 600;">
          ${b.branchName}
        </td>
        <td style="padding: 12px 16px; text-align: right;">
          <span style="display: inline-block; background: #0f172a; border: 1px solid #f59e0b; color: #fbbf24; font-family: 'Courier New', Courier, monospace; font-size: 13px; font-weight: 700; padding: 4px 10px; rounded: 6px; letter-spacing: 1px;">
            ${b.code}
          </span>
        </td>
      </tr>
    `
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Dineiz — ${data.restaurantName}</title>
  <style>
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .hero-title { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 32px 12px;">
    <tr>
      <td align="center">
        
        <!-- Main Email Container -->
        <table class="email-container" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Top Accent Bar -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #ff5722 0%, #ff8a65 50%, #f59e0b 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 36px 20px 36px; text-align: center;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <!-- Dineiz Flame Logo Emblem -->
                    <div style="display: inline-block; background: linear-gradient(135deg, #ff5722 0%, #d84315 100%); width: 44px; height: 44px; border-radius: 12px; line-height: 44px; text-align: center; vertical-align: middle; box-shadow: 0 4px 12px rgba(255, 87, 34, 0.4);">
                      <span style="color: #ffffff; font-size: 22px; font-weight: 900; line-height: 44px;">D</span>
                    </div>
                    <div style="margin-top: 10px;">
                      <span style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 2px;">DINEIZ</span>
                      <span style="display: block; font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px;">Restaurant Operating System</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Greeting -->
          <tr>
            <td class="content-padding" style="padding: 10px 36px 24px 36px; text-align: center;">
              <h1 class="hero-title" style="margin: 0 0 10px 0; font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.25;">
                Welcome aboard, ${data.ownerName}! 👋
              </h1>
              <p style="margin: 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                Your restaurant <strong style="color: #ff8a65;">${data.restaurantName}</strong> has been successfully set up on the <strong style="color: #38bdf8;">${data.plan} Plan</strong>.
              </p>
            </td>
          </tr>

          <!-- Primary CTA Button -->
          <tr>
            <td align="center" style="padding: 0 36px 32px 36px;">
              <table border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #ff5722 0%, #f4511e 100%); box-shadow: 0 8px 20px rgba(255, 87, 34, 0.35);">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.5px;">
                      Open Dineiz Dashboard &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Account Credentials Card -->
          <tr>
            <td class="content-padding" style="padding: 0 36px 28px 36px;">
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #f59e0b; letter-spacing: 1px;">
                  🔒 Your Admin Account Credentials
                </h3>
                
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; width: 140px;">Console URL:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #38bdf8; font-weight: 600;">
                      <a href="${loginUrl}" style="color: #38bdf8; text-decoration: none;">${loginUrl}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Login Email:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #ffffff; font-weight: 600; font-family: monospace;">
                      ${data.ownerEmail}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Temporary Password:</td>
                    <td style="padding: 6px 0;">
                      <span style="background: #0f172a; border: 1px solid #475569; color: #34d399; font-family: 'Courier New', Courier, monospace; font-size: 14px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
                        ${data.password}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Subscription Plan:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #ffffff; font-weight: 600;">
                      ${data.plan} (${data.billingCycle})
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; font-size: 13px; color: #94a3b8;">Status / Period:</td>
                    <td style="padding: 6px 0; font-size: 13px; color: #a7f3d0; font-weight: 600;">
                      ${trialText}
                    </td>
                  </tr>
                </table>

                <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid #334155; font-size: 11px; color: #cbd5e1;">
                  ⚠️ <em>For security, we recommend updating your password upon your first login.</em>
                </div>
              </div>
            </td>
          </tr>

          <!-- Branches & POS Access Codes Card -->
          <tr>
            <td class="content-padding" style="padding: 0 36px 28px 36px;">
              <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 24px;">
                <h3 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #f59e0b; letter-spacing: 1px;">
                  🏪 Initial Branch & POS Access Codes
                </h3>
                <p style="margin: 0 0 16px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                  Use these access codes when connecting your POS terminal or KDS screens:
                </p>

                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; overflow: hidden;">
                  ${branchItems}
                </table>

                <!-- Self-Serve Branches Clarification Banner -->
                <div style="margin-top: 16px; background: #0f172a; border-left: 3px solid #ff5722; padding: 12px 14px; border-radius: 6px;">
                  <p style="margin: 0; font-size: 12px; color: #e2e8f0; line-height: 1.5;">
                    💡 <strong>Manage & Add More Branches:</strong> You have full control! You can create additional branches, update addresses, manage tables, and generate new POS terminals at any time from your <strong>Dashboard &gt; Branches</strong> page.
                  </p>
                </div>
              </div>
            </td>
          </tr>

          <!-- Getting Started Steps -->
          <tr>
            <td class="content-padding" style="padding: 0 36px 32px 36px;">
              <h3 style="margin: 0 0 16px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #94a3b8; letter-spacing: 1px;">
                🚀 Quick Start Checklist
              </h3>
              
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 28px; color: #ff5722; font-weight: 800; font-size: 14px;">1.</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                    <strong style="color: #ffffff;">Sign in to your Dashboard</strong> at <a href="${loginUrl}" style="color: #ff8a65; text-decoration: none;">${loginUrl}</a>.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 28px; color: #ff5722; font-weight: 800; font-size: 14px;">2.</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                    <strong style="color: #ffffff;">Set Up Menu & Inventory:</strong> Add your categories, menu items, prices, and recipe ingredients.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 28px; color: #ff5722; font-weight: 800; font-size: 14px;">3.</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                    <strong style="color: #ffffff;">Launch POS & Kitchen Screens:</strong> Open the POS app on your terminal/tablet and enter your Branch Access Code.
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; vertical-align: top; width: 28px; color: #ff5722; font-weight: 800; font-size: 14px;">4.</td>
                  <td style="padding: 8px 0; font-size: 13px; color: #cbd5e1; line-height: 1.4;">
                    <strong style="color: #ffffff;">Invite Staff Members:</strong> Create 4-digit PINs for cashiers, waiters, and kitchen teams in <em>Staff Management</em>.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Support & Footer -->
          <tr>
            <td style="background-color: #0b0f19; padding: 28px 36px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 13px; color: #94a3b8;">
                Need assistance setting up hardware or training your staff?
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px;">
                <a href="mailto:support@dineiz.com" style="color: #ff8a65; text-decoration: none; font-weight: 600; margin: 0 10px;">support@dineiz.com</a>
                <span style="color: #475569;">&bull;</span>
                <a href="https://dineiz.com/docs" style="color: #94a3b8; text-decoration: none; margin: 0 10px;">Help Center & Guides</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Dineiz Technologies (Pvt) Ltd. All rights reserved.<br>
                Empowering modern restaurants with real-time POS, KDS & inventory intelligence.
              </p>
            </td>
          </tr>

        </table>
        <!-- End Container -->

      </td>
    </tr>
  </table>

</body>
</html>
  `;
}
