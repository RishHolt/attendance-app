import nodemailer from "nodemailer"

const getTransporter = () => {
  const user = process.env.GMAIL_USER?.trim()
  const pass = process.env.GMAIL_APP_PASSWORD?.trim()

  if (!user || !pass) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env.local")
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const transporter = getTransporter()
  const from = process.env.GMAIL_USER?.trim()

  await transporter.sendMail({
    from: `"SDO Attendance" <${from}>`,
    to,
    subject: "Reset your password",
    text: `You requested a password reset.\n\nClick the link below to set a new password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="margin-bottom:8px;font-size:20px;color:#18181b;">Reset your password</h2>
        <p style="color:#52525b;margin-bottom:24px;">
          You requested a password reset for your SDO Attendance account.
          Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
          Reset password
        </a>
        <p style="margin-top:24px;font-size:12px;color:#a1a1aa;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${resetUrl}" style="color:#52525b;word-break:break-all;">${resetUrl}</a>
        </p>
        <p style="margin-top:16px;font-size:12px;color:#a1a1aa;">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
