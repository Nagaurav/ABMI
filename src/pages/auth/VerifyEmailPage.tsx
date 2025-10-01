import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = searchParams.get('token');
  const email = searchParams.get('email');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token || !email) {
        setStatus('error');
        setError('Invalid verification link');
        return;
      }

      try {
        // In a real app, you would verify the token with your backend
        // For now, we'll simulate a successful verification
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Simulate successful verification
        setStatus('success');
        
        // Update the user's email verification status in the UI
        // In a real app, you would update this in your auth state
        
        toast.success('Your email has been successfully verified.');
        
      } catch (error) {
        console.error('Error verifying email:', error);
        setStatus('error');
        setError('Failed to verify email. The link may have expired or is invalid.');
      }
    };

    verifyEmail();
  }, [token, email, toast]);

  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <h3 className="mt-4 text-lg font-medium text-foreground">Verifying your email...</h3>
          <p className="mt-2 text-muted-foreground">Please wait while we verify your email address.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
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
          <h3 className="mt-4 text-lg font-medium text-foreground">
            Verification Failed
          </h3>
          <p className="mt-2 text-muted-foreground">
            {error || 'The verification link is invalid or has expired.'}
          </p>
          <div className="mt-6">
            <Button
              onClick={() => navigate('/login')}
              variant="outline"
              className="mr-2"
            >
              Back to Login
            </Button>
            <Button
              onClick={() => navigate('/resend-verification')}
              variant="default"
            >
              Resend Verification Email
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 lg:px-8">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-foreground">
          Email Verified Successfully!
        </h3>
        <p className="mt-2 text-muted-foreground">
          Your email has been successfully verified. You can now access all features of our platform.
        </p>
        <div className="mt-6">
          <Button
            onClick={() => navigate('/dashboard')}
            className="mr-2"
          >
            Go to Dashboard
          </Button>
          <Button
            onClick={() => navigate('/login')}
            variant="outline"
          >
            Sign In
          </Button>
        </div>
      </div>
    </div>
  );
}
