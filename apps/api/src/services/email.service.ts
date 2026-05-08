import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendInvoiceEmail({
  to,
  clientName,
  businessName,
  invoiceNumber,
  invoiceTotal,
  currency,
  dueDate,
  pdfBuffer,
  pdfFilename,
}: {
  to: string;
  clientName: string;
  businessName: string;
  invoiceNumber: string;
  invoiceTotal: number;
  currency: string;
  dueDate?: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}) {
  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
  }).format(invoiceTotal);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${invoiceNumber}</title>
    </head>
    <body style="margin:0;padding:0;background:#F8F7FF;font-family:Inter,Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#F8F7FF;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0"
                 style="background:#ffffff;border-radius:12px;
                        box-shadow:0 2px 8px rgba(0,0,0,0.08);
                        overflow:hidden;">

            <!-- Header -->
            <tr>
              <td style="background:#6C63FF;padding:32px 40px;">
                <h1 style="margin:0;color:#ffffff;font-size:24px;
                           font-weight:600;">
                  Invoice from ${businessName}
                </h1>
                <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);
                           font-size:14px;">
                  Invoice #${invoiceNumber}
                </p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:40px;">
                <p style="margin:0 0 24px;color:#1A1825;font-size:15px;">
                  Dear ${clientName},
                </p>
                <p style="margin:0 0 24px;color:#6B6880;font-size:14px;
                           line-height:1.6;">
                  Please find your invoice attached to this email.
                  Here is a summary of the amount due:
                </p>

                <!-- Invoice Summary Box -->
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#F8F7FF;border-radius:8px;
                              margin-bottom:28px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="color:#6B6880;font-size:13px;
                                     padding-bottom:8px;">
                            Invoice Number
                          </td>
                          <td align="right"
                              style="color:#1A1825;font-size:13px;
                                     font-weight:600;font-family:monospace;
                                     padding-bottom:8px;">
                            ${invoiceNumber}
                          </td>
                        </tr>
                        ${dueDate ? `
                        <tr>
                          <td style="color:#6B6880;font-size:13px;
                                     padding-bottom:8px;">
                            Due Date
                          </td>
                          <td align="right"
                              style="color:#1A1825;font-size:13px;
                                     padding-bottom:8px;">
                            ${dueDate}
                          </td>
                        </tr>` : ''}
                        <tr>
                          <td style="color:#6B6880;font-size:14px;
                                     font-weight:600;padding-top:8px;
                                     border-top:1px solid #E4E2F0;">
                            Total Amount Due
                          </td>
                          <td align="right"
                              style="color:#6C63FF;font-size:18px;
                                     font-weight:700;padding-top:8px;
                                     border-top:1px solid #E4E2F0;">
                            ${formattedTotal}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 32px;color:#6B6880;font-size:13px;
                           line-height:1.6;">
                  The invoice PDF is attached to this email.
                  Please review and process payment at your earliest convenience.
                </p>

                <p style="margin:0;color:#6B6880;font-size:13px;">
                  If you have any questions, please reply to this email.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 40px;
                         border-top:1px solid #E4E2F0;
                         background:#F8F7FF;">
                <p style="margin:0;color:#9B98AE;font-size:12px;
                           text-align:center;">
                  This invoice was sent by ${businessName} using QuickInvoice.
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  const info = await transporter.sendMail({
    from: `"${businessName}" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Invoice #${invoiceNumber} from ${businessName}`,
    html,
    attachments: [
      {
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return { messageId: info.messageId };
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

export async function sendInvitationEmail({
  to,
  orgName,
  role,
  inviteLink,
}: {
  to: string;
  orgName: string;
  role: string;
  inviteLink: string;
}) {
  const subject = `You have been invited to ${orgName} on QuickInvoice`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#F8F7FF;padding:32px;">
      <div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;padding:32px;border:1px solid #E4E2F0;">
        <h1 style="margin:0 0 12px;color:#1A1825;font-size:22px;">Join ${orgName}</h1>
        <p style="margin:0 0 20px;color:#6B6880;font-size:14px;line-height:1.6;">
          You have been invited as <strong>${role}</strong>. Use the button below to accept your invitation.
        </p>
        <a href="${inviteLink}" style="display:inline-block;background:#6C63FF;color:white;text-decoration:none;border-radius:8px;padding:12px 18px;font-weight:600;">
          Accept invitation
        </a>
        <p style="margin:24px 0 0;color:#9B98AE;font-size:12px;line-height:1.5;">
          If the button does not work, paste this link into your browser:<br />
          ${inviteLink}
        </p>
      </div>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || process.env.SMTP_FROM || 'QuickInvoice <noreply@quickinvoice.app>',
        to,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to send invitation email: ${text}`);
    }

    return response.json();
  }

  const info = await transporter.sendMail({
    from: `"QuickInvoice" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html,
  });

  return { messageId: info.messageId };
}
