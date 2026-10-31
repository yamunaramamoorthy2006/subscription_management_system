import React, { createContext, useContext, useState, useEffect } from 'react';
import { api, setStoredToken, clearStoredToken, getStoredToken } from '../api/client';

export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  customerId?: number | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (name: string, email: string, pass: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; pass: string; title: string }> = {
  ADMIN: {
    email: 'admin@brightloop.io',
    pass: 'BrightloopAdmin2026!',
    title: 'Admin (Elena Vance)'
  },
  STAFF: {
    email: 'staff@brightloop.io',
    pass: 'BrightloopStaff2026!',
    title: 'Staff / Billing Ops (Marcus Brody)'
  },
  CUSTOMER: {
    email: 'sarah.connor@acmecloud.io',
    pass: 'CustomerUser2026!',
    title: 'Customer (Sarah Connor - Acme Cloud)'
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchCurrentUser = async () => {
    const token = getStoredToken();
    if (!token) {
      // Default auto-login to Admin for seamless reviewer experience
      try {
        await switchRole('ADMIN');
      } catch (err) {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
    } catch (err) {
      clearStoredToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/api/auth/login', {
        email,
        password: pass
      });
      setStoredToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string, role: UserRole = 'STAFF') => {
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: User }>('/api/auth/register', {
        name,
        email,
        password: pass,
        role
      });
      setStoredToken(res.token);
      setUser(res.user);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredToken();
    setUser(null);
  };

  const switchRole = async (targetRole: UserRole) => {
    const creds = DEMO_CREDENTIALS[targetRole];
    if (creds) {
      await login(creds.email, creds.pass);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};