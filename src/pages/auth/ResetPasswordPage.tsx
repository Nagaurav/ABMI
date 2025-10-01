import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authUtils } from '@/lib/auth-utils';

/**
 * Displays a toast notification
 * @param message - The message to display
 * @param type - The type of toast ('success' or 'error')
 */
const showToast = (message: string, type: 'success' | 'error' = 'success') => {
  // In a production app, you would use a proper toast library like react-toastify or sonner
  console.log(`${type.toUpperCase()}: ${message}`);
  
  // For a simple UI feedback, we'll use the browser's alert for now
  // In a real app, you would replace this with a proper toast component
  if (type === 'error') {
    alert(`Error: ${message}`);
  } else {
    alert(`Success: ${message}`);
  }
};

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsValidToken(false);
        setError('Invalid or expired reset token');
        return;
      }

      try {
        // In a real app, you would verify the token with your backend
        // For now, we'll just check if the token exists
        setIsValidToken(!!token);
      } catch (error) {
        console.error('Error verifying token:', error);
        setIsValidToken(false);
        setError('Invalid or expired reset token');
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (!token) {
      setError('Invalid or expired reset token');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      const { success, error: resetError } = await authUtils.updatePassword(password);
      
      if (success) {
        showToast('Your password has been reset successfully.', 'success');
        
        // Redirect to login after a short delay
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        throw new Error(resetError || 'Failed to reset password');
      }
    } catch (error: any) {
      const errorMessage = authUtils.handleAuthError(error);
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidToken === null) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        padding: '3rem 1.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            border: '2px solid #3b82f6',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        padding: '3rem 1.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem',
            height: '3rem',
            backgroundColor: '#fee2e2',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto'
          }}>
            <svg
              style={{
                width: '1.5rem',
                height: '1.5rem',
                color: '#dc2626'
              }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h3 style={{ 
            marginTop: '1rem', 
            fontSize: '1.125rem', 
            fontWeight: 500,
            color: '#111827'
          }}>
            Invalid or Expired Link
          </h3>
          <p style={{ 
            marginTop: '0.5rem', 
            color: '#6b7280'
          }}>
            The password reset link is invalid or has expired. Please request a new one.
          </p>
          <div style={{ marginTop: '1.5rem' }}>
            <button
              onClick={() => navigate('/forgot-password')}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#111827',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
              }}
            >
              Request New Reset Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '3rem 1.5rem'
    }}>
      <div style={{
        margin: '0 auto',
        width: '100%',
        maxWidth: '28rem'
      }}>
        <h2 style={{
          marginTop: '1.5rem',
          textAlign: 'center',
          fontSize: '1.875rem',
          fontWeight: 800,
          lineHeight: '2.25rem',
          color: '#111827'
        }}>
          Reset your password
        </h2>
        <p style={{
          marginTop: '0.5rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          Enter a new password for your account
        </p>
      </div>

      <div style={{
        marginTop: '2rem',
        marginLeft: 'auto',
        marginRight: 'auto',
        width: '100%',
        maxWidth: '28rem'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem 1rem',
          borderRadius: '0.5rem',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
        }}>
          {error && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              fontSize: '0.875rem',
              borderRadius: '0.375rem'
            }}>
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <div>
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                New Password
              </label>
              <div style={{ marginTop: '0.25rem' }}>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    fontSize: '0.875rem',
                    lineHeight: '1.25rem',
                    color: '#111827',
                    backgroundColor: 'white',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                Confirm New Password
              </label>
              <div style={{ marginTop: '0.25rem' }}>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                    fontSize: '0.875rem',
                    lineHeight: '1.25rem',
                    color: '#111827',
                    backgroundColor: 'white',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                  }}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  display: 'flex',
                  width: '100%',
                  justifyContent: 'center',
                  padding: '0.5rem 1rem',
                  border: '1px solid transparent',
                  borderRadius: '0.375rem',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'white',
                  backgroundColor: '#3b82f6',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  opacity: isLoading ? 0.7 : 1,
                  pointerEvents: isLoading ? 'none' : 'auto'
                }}
                onMouseOver={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                {isLoading ? 'Resetting password...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
