'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, AuthResponse, User } from './types';
import { authApi } from './api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Maps the backend's flat AuthResponse into the normalised User we keep client-side. */
function toUser(res: AuthResponse): User {
  return {
    id: res.userId,
    email: res.email,
    fullName: res.fullName,
    role: res.role === 'MANAGER' ? 'manager' : 'handler',
    farmId: res.farmId,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = localStorage.getItem('auth_token');

    if (storedUser && token) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      const userData = toUser(res);

      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // The backend is stateless (JWT); logout is purely client-side token disposal.
  const logout = async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
