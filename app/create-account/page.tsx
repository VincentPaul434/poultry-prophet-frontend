'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Role, User } from '@/lib/types';
import { AlertCircle, Loader2, Lock, Mail, User as UserIcon, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function toUserFromRegister(response: Awaited<ReturnType<typeof authApi.register>>): User {
  return {
    id: response.userId,
    email: response.email,
    fullName: response.fullName,
    role: response.role === 'MANAGER' ? 'manager' : 'handler',
    farmId: response.farmId,
  };
}

export default function CreateAccountPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('MANAGER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        fullName,
        email,
        password,
        role,
      });

      const user = toUserFromRegister(response);
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user', JSON.stringify(user));
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed');
    } finally {
      setLoading(false);
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
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
        style={{
          background:
            'linear-gradient(90deg, var(--color-forest), var(--color-moss), var(--color-amber))',
        }}
      />

      <div className="flex w-full max-w-2xl flex-col items-center space-y-8">
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
              Create account
            </CardTitle>
            <CardDescription>Managers create a new farm automatically. Handlers register without a farm ID.</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <div className="relative">
                    <UserIcon
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-muted)' }}
                    />
                    <Input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Jane Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
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
                      type="password"
                      autoComplete="new-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                      style={{ color: 'var(--color-muted)' }}
                    />
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat the password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Account type</Label>
                  <Select value={role} onValueChange={(value) => setRole(value as Role)} disabled={loading}>
                    <SelectTrigger id="role" className="w-full">
                      <Shield className="mr-2 h-4 w-4" style={{ color: 'var(--color-muted)' }} />
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HANDLER">Handler</SelectItem>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[var(--color-forest)] text-[var(--color-paper)] transition-colors hover:bg-[var(--color-forest-dark)]"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create account'
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs" style={{ color: 'var(--color-muted)' }}>
              Already have an account?{' '}
              <a href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-forest)' }}>
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}