import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { authUtils } from '@/lib/auth-utils';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setIsLoading(true);
    
    try {
      const { success, error } = await authUtils.resetPassword(email);
      
      if (success) {
        setIsEmailSent(true);
        toast.success('Check your email for a link to reset your password.');
      } else {
        throw new Error(error || 'Failed to send password reset email');
      }
    } catch (error: any) {
      const errorMessage = authUtils.handleAuthError(error);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Check your email
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We've sent a password reset link to {email}
          </p>
          
          <div className="mt-8 bg-card p-8 shadow sm:rounded-lg sm:px-10">
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
              <h3 className="mt-3 text-lg font-medium text-foreground">
                Password reset email sent
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                We've sent a password reset link to your email address. If you don't see it, please check your spam folder.
              </p>
              <div className="mt-6">
                <Link
                  to="/login"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Back to sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col justify-center px-6 py-12 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Forgot your password?
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Enter your email and we'll send you a link to reset your password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email address</Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-border rounded-md shadow-sm placeholder-muted-foreground focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
            </div>

            <div>
              <Button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-sm font-medium text-primary hover:text-primary/80"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
