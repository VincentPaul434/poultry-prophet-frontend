'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const REMEMBERED_EMAIL_KEY = 'remembered_email';

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Prefill a remembered email so returning users only type their password.
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError('Please enter email and password');
      return;
    }

    try {
      await login(email, password);

      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      router.push('/dashboard');
    } catch (err) {
      setLocalError('Invalid email or password');
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{
        background:
          'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--color-moss-light) 35%, transparent), transparent 70%), linear-gradient(180deg, var(--color-paper), var(--color-cream))',
      }}
    >
      {/* Decorative accent bar */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{
          background:
            'linear-gradient(90deg, var(--color-forest), var(--color-moss), var(--color-amber))',
        }}
      />

      <div className="flex w-full max-w-md flex-col items-center space-y-8">
        {/* Brand */}
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="Poultry Prophet" className="h-auto w-44 object-contain" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-forest)' }}>
              Poultry Prophet
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              Game fowl breeding &amp; selection
            </p>
          </div>
        </div>

        <Card className="w-full border-[var(--color-line)] shadow-lg shadow-[var(--color-forest)]/5">
          <CardHeader className="space-y-1.5 text-center">
            <CardTitle className="text-2xl font-bold" style={{ color: 'var(--color-forest)' }}>
              Login
            </CardTitle>
            <CardDescription>Sign in to manage your flock</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {(error || localError) && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error || localError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'var(--color-muted)' }}
                  />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-9"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: 'var(--color-muted)' }}
                  />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="px-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 transition-colors hover:bg-[var(--color-cream)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm select-none">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={loading}
                  />
                  <span style={{ color: 'var(--color-ink)' }}>Remember me</span>
                </label>

                <a
                  href="#"
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--color-forest)' }}
                >
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                className="w-full bg-[var(--color-forest)] text-[var(--color-paper)] transition-colors hover:bg-[var(--color-forest-dark)]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
              Use your farm&apos;s handler or manager account to sign in.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
