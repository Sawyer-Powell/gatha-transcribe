import { useState, useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { useAppLocalStore } from '../stores/appLocalStore';
import { Button } from '../components/ui/button';

export const LoginPage = () => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, error, isLoading, user, isInitialized, checkAuth } = useAppLocalStore();
  const location = useLocation();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!isInitialized) {
      checkAuth();
    } else if (user) {
      location.route('/', true);
    }
  }, [user, isInitialized, checkAuth, location]);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    try {
      if (activeTab === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      location.route('/'); // Redirect to transcription page after success
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border">
        <h1 className="text-2xl font-bold text-center">
          {activeTab === 'login' ? 'Login' : 'Create Account'}
        </h1>

        {/* Tab Switcher */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'login' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('login')}
          >
            Login
          </Button>
          <Button
            variant={activeTab === 'register' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setActiveTab('register')}
          >
            Register
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit as any} className="space-y-4">
          {activeTab === 'register' && (
            <div>
              <label htmlFor="name-input" className="block text-sm font-medium mb-1">Name</label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName((e.target as HTMLInputElement).value)}
                required
                className="w-full px-3 py-2 border rounded-lg bg-background"
              />
            </div>
          )}

          <div>
            <label htmlFor="email-input" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
              required
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>

          <div>
            <label htmlFor="password-input" className="block text-sm font-medium mb-1">Password</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border rounded-lg bg-background"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Processing...' : activeTab === 'login' ? 'Login' : 'Register'}
          </Button>
        </form>
      </div>
    </div>
  );
};
