/**
 * AuthContext — provides authentication state to the entire app.
 * Manages login, logout, and session persistence.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type AuthUser,
  type AuthVendor,
  type LoginCredentials,
  login as authLogin,
  logout as authLogout,
  getToken,
  getStoredUser,
  getStoredVendor,
} from '@/services/auth';

interface AuthState {
  user: AuthUser | null;
  vendor: AuthVendor | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    vendor: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session on app start
  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const [token, user, vendor] = await Promise.all([
        getToken(),
        getStoredUser(),
        getStoredVendor(),
      ]);

      if (token && user) {
        setState({
          user,
          vendor,
          token,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }

  async function login(credentials: LoginCredentials) {
    const response = await authLogin(credentials);

    setState({
      user: response.user,
      vendor: response.vendor,
      token: response.access_token,
      isLoading: false,
      isAuthenticated: true,
    });
  }

  async function logout() {
    await authLogout();
    setState({
      user: null,
      vendor: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
