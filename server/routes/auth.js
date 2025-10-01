import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { sendOtpEmail, sendPasswordResetEmail, sendVerificationEmail } from '../services/email.js';
import { otpStore, resetTokenStore } from '../services/otpStore.js';
import User from '../models/User.js';
import { generateToken, authMiddleware } from '../utils/jwt.js';

const router = Router();

// Input validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Register a new user
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
    body('name').trim().notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      // Check if user already exists
      if (await User.findByEmail(email)) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Create user
      const user = await User.create({ email, password, name });
      
      // Generate verification token
      const verificationToken = otpStore.generate(email);
      await sendVerificationEmail(email, verificationToken);

      // Generate JWT token
      const token = generateToken({ id: user.id, email: user.email });
      
      // Return user data (excluding password) and token
      res.status(201).json({ 
        user: user.toJSON(),
        token,
        message: 'Registration successful. Please check your email to verify your account.'
      });
    } catch (error) {
      console.error('[auth] register failed', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// Login user
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const isPasswordValid = await user.validatePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = generateToken({ id: user.id, email: user.email });
      
      // Return user data (excluding password) and token
      res.json({ 
        user: user.toJSON(),
        token,
        message: 'Login successful'
      });
    } catch (error) {
      console.error('[auth] login failed', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// Request password reset
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findByEmail(email);
      
      // Don't reveal if user doesn't exist
      if (!user) {
        return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
      }

      // Generate and store reset token
      const resetToken = resetTokenStore.generate(email);
      await sendPasswordResetEmail(email, resetToken);

      res.json({ message: 'Password reset link sent to your email' });
    } catch (error) {
      console.error('[auth] forgot-password failed', error);
      res.status(500).json({ error: 'Failed to process password reset' });
    }
  }
);

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }),
  ],
  validate,
  async (req, res) => {
    try {
      const { token, password } = req.body;
      const email = resetTokenStore.verify(token);
      
      if (!email) {
        return res.status(400).json({ error: 'Invalid or expired token' });
      }

      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(400).json({ error: 'User not found' });
      }

      // Update password
      user.password = await bcrypt.hash(password, 10);
      user.updatedAt = new Date();
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('[auth] reset-password failed', error);
      res.status(500).json({ error: 'Failed to reset password' });
    }
  }
);

// Verify email
router.get('/verify-email', async (req, res) => {
  try {
    const { token, email } = req.query;
    
    if (!token || !email) {
      return res.status(400).json({ error: 'Token and email are required' });
    }

    const isValid = otpStore.verify(email, token);
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid or expired verification link' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    user.isEmailVerified = true;
    await user.save();

    // Redirect to success page or return success response
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('[auth] verify-email failed', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Get current user (protected route)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user.toJSON());
  } catch (error) {
    console.error('[auth] get user failed', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;



