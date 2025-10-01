import nodemailer from 'nodemailer';

function mask(value) {
  if (!value) return '';
  if (value.length <= 4) return '*'.repeat(value.length);
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

// Create a reusable transporter object using the default SMTP transport
let transporter;

async function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    const err = new Error('SMTP env not configured: require SMTP_HOST, SMTP_USER, SMTP_PASS');
    console.error('[email] configuration error', err.message, {
      host: SMTP_HOST,
      port: SMTP_PORT,
      user: mask(SMTP_USER),
      from: SMTP_FROM ? SMTP_FROM : '(not set)'
    });
    throw err;
  }

  const port = SMTP_PORT ? Number(SMTP_PORT) : 587;
  const secure = port === 465;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  try {
    await transporter.verify();
    return transporter;
  } catch (e) {
    console.error('[email] SMTP verify failed', {
      host: SMTP_HOST,
      port,
      user: mask(SMTP_USER),
      message: e?.message,
      code: e?.code,
      command: e?.command
    });
    throw e;
  }
}

// Email templates
const templates = {
  verification: (email, token) => ({
    subject: 'Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ABMI!</h2>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}&email=${encodeURIComponent(email)}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p>${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}&email=${encodeURIComponent(email)}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `,
    text: `Welcome to ABMI!\n\nPlease verify your email address by visiting this link:\n${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}&email=${encodeURIComponent(email)}\n\nThis link will expire in 1 hour.`
  }),

  passwordReset: (email, token) => ({
    subject: 'Reset Your Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Reset Your Password</h2>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}" 
             style="background-color: #4CAF50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p>${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
      </div>
    `,
    text: `Reset Your Password\n\nClick the link below to set a new password:\n${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}\n\nThis link will expire in 1 hour.`
  }),

  otp: (email, otp) => ({
    subject: 'Your ABMI Verification Code',
    text: `Your One-Time Password is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family: Inter, system-ui, sans-serif; color: #e5e7eb; background: #0b0f14; padding: 24px; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #fff; margin: 0 0 8px;">ABMI Verification</h2>
        <p style="margin: 0 0 16px;">Use the code below to continue. It expires in 5 minutes.</p>
        <div style="font-size: 32px; letter-spacing: 6px; background: #111827; color: #22d3ee; padding: 12px 16px; border-radius: 8px; display: inline-block;">
          ${otp}
        </div>
      </div>
    `
  })
};

/**
 * Send an email using the specified template
 * @param {string} to - Recipient email address
 * @param {string} template - Template name (verification, passwordReset, otp)
 * @param {Object} data - Template data
 * @returns {Promise<string>} - Message ID
 */
async function sendEmail(to, template, data) {
  const transporter = await getTransporter();
  const templateFn = templates[template];
  
  if (!templateFn) {
    throw new Error(`Invalid email template: ${template}`);
  }

  const { subject, html, text } = templateFn(to, data);
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from: `"ABMI" <${from}>`,
      to,
      subject,
      text,
      html
    });

    console.log(`[email] ${template} sent`, { 
      to, 
      messageId: info.messageId 
    });

    return info.messageId;
  } catch (error) {
    console.error(`[email] ${template} send failed`, {
      to,
      error: error.message,
      code: error.code,
      response: error.response,
      stack: error.stack
    });
    throw error;
  }
}

// Export specific email sending functions
export async function sendVerificationEmail(email, token) {
  return sendEmail(email, 'verification', { token });
}

export async function sendPasswordResetEmail(email, token) {
  return sendEmail(email, 'passwordReset', { token });
}

export async function sendOtpEmail(email, otp) {
  return sendEmail(email, 'otp', { otp });
}



