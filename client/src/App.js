import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar    from './components/Navbar';
import Home      from './pages/Home';
import Login     from './pages/Login';
import Register  from './pages/Register';
import History   from './pages/History';
import Shopping  from './pages/Shopping';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '0.87rem',
              fontWeight: 500,
              background: '#ffffff',
              color: '#0f172a',
              border: '1.5px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            },
            success: {
              iconTheme: { primary: '#16a34a', secondary: '#f0fdf4' },
            },
          }}
        />
        <Navbar />
        <Routes>
          <Route path="/"         element={<Home />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/history"  element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/shopping" element={<PrivateRoute><Shopping /></PrivateRoute>} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
