/**
 * CustomerAuthContext — provides customer authentication state.
 * Separate from vendor AuthContext for clean role separation.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type CustomerUser,
  type CustomerLoginCredentials,
  type CustomerRegisterData,
  loginCustomer,
  registerCustomer,
  logoutCustomer,
  getCustomerToken,
  getStoredCustomer,
} from '@/services/customer-auth';

interface CustomerAuthState {
  user: CustomerUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface CustomerAuthContextValue extends CustomerAuthState {
  login: (credentials: CustomerLoginCredentials) => Promise<void>;
  register: (data: CustomerRegisterData) => Promise<void>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CustomerAuthState>({
    user: null,
    token: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const [token, user] = await Promise.all([
        getCustomerToken(),
        getStoredCustomer(),
      ]);

      if (token && user) {
        setState({ user, token, isLoading: false, isAuthenticated: true });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }

  async function login(credentials: CustomerLoginCredentials) {
    const response = await loginCustomer(credentials);
    setState({
      user: response.user,
      token: response.access_token,
      isLoading: false,
      isAuthenticated: true,
    });
  }

  async function register(data: CustomerRegisterData) {
    const response = await registerCustomer(data);
    setState({
      user: response.user,
      token: response.access_token,
      isLoading: false,
      isAuthenticated: true,
    });
  }

  async function logout() {
    await logoutCustomer();
    setState({ user: null, token: null, isLoading: false, isAuthenticated: false });
  }

  return (
    <CustomerAuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}
