import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authUtils } from '../../lib/auth-utils';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuthenticated = await authUtils.isAuthenticated();
        
        if (isAuthenticated && requiredRole) {
          // If a role is required, check if the user has it
          const user = await authUtils.getCurrentUser();
          const userRole = user?.user_metadata?.role || 'user';
          
          if (userRole === requiredRole) {
            setIsAuthorized(true);
          } else {
            // User doesn't have the required role
            setIsAuthorized(false);
          }
        } else {
          // No role required, just check authentication
          setIsAuthorized(isAuthenticated);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Checking authentication...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    // Redirect to login page, but save the current location they were trying to go to
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
