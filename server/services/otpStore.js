const store = new Map();
const resetTokens = new Map();

function generateCode(length = 6) {
  return String(Math.floor(Math.pow(10, length - 1) + Math.random() * 9 * Math.pow(10, length - 1)));
}

function generateToken() {
  return require('crypto').randomBytes(32).toString('hex');
}

// OTP Store for email verification
export const otpStore = {
  generate(email) {
    const otp = generateCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
    store.set(`otp:${email}`, { otp, expiresAt });
    return otp;
  },
  
  verify(email, otp) {
    const entry = store.get(`otp:${email}`);
    if (!entry) return false;
    const valid = entry.otp === otp && Date.now() < entry.expiresAt;
    if (valid) store.delete(`otp:${email}`);
    return valid;
  }
};

// Password reset token store
export const resetTokenStore = {
  generate(email) {
    const token = generateToken();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
    resetTokens.set(token, { email, expiresAt });
    
    // Clean up expired tokens
    this.cleanup();
    
    return token;
  },
  
  verify(token) {
    const entry = resetTokens.get(token);
    if (!entry) return null;
    
    const isValid = Date.now() < entry.expiresAt;
    if (isValid) {
      resetTokens.delete(token);
      return entry.email;
    }
    
    return null;
  },
  
  cleanup() {
    const now = Date.now();
    for (const [token, { expiresAt }] of resetTokens.entries()) {
      if (now >= expiresAt) {
        resetTokens.delete(token);
      }
    }
  }
};



