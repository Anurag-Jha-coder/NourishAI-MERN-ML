import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export const API = '/api';   // proxied to http://localhost:5000 via package.json proxy

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Rehydrate on mount ─────────────────────────────────── */
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.get(`${API}/auth/me`)
        .then(r  => setUser(r.data.user))
        .catch(() => _clearAuth())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  /* ── Helpers ────────────────────────────────────────────── */
  const _setAuth = (token, user) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(user);
  };

  const _clearAuth = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  /* ── Actions ────────────────────────────────────────────── */
  const login = async (email, password) => {
    const { data } = await axios.post(`${API}/auth/login`, { email, password });
    _setAuth(data.token, data.user);
    return data.user;
  };

  const register = async (name, email, password) => {
    const { data } = await axios.post(`${API}/auth/register`, { name, email, password });
    _setAuth(data.token, data.user);
    return data.user;
  };

  const logout = () => _clearAuth();

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
