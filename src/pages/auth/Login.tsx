import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { motion } from 'framer-motion';

export const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(formData.email, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Perfectly centered circular logo */}
        <div className="flex justify-center mb-6">
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 bg-white rounded-full shadow-lg overflow-hidden p-2">
              <div className="w-full h-full flex items-center justify-center">
                <img 
                  src="/images/Gemini_Generated_Image_8zv1rl8zv1rl8zv1.png" 
                  alt="Company Logo" 
                  className="max-w-full max-h-full object-contain"
                  style={{
                    width: 'auto',
                    height: 'auto',
                    maxWidth: '85%',
                    maxHeight: '85%',
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0id2hpdGUiPjxwYXRoIGQ9Ik0xMiAxMmw0LTZoLTh6Ii8+PHBhdGggZD0iTTEyIDZsLTQgNmg4eiIvPjwvc3ZnPg==';
                  }}
                />
              </div>
            </div>
          </div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800 p-8 rounded-lg shadow-lg"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2">
              Sign in to your account
            </h2>
            <p className="text-sm text-gray-400">
              Or{' '}
              <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
                create a new account
              </Link>
            </p>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-md text-sm">
              {error}
            </div>
          )}

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-sm text-indigo-400 hover:text-indigo-300">
                    Forgot password?
                  </Link>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};