import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropRef = useRef(null);

  const handleLogout = () => { logout(); navigate('/'); setOpen(false); };
  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onClick = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-inner">

        {/* Logo */}
        <Link to="/" className="nav-logo">
          <div className="nav-logo-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10" /><path d="M12 22a10 10 0 0 1-10-10" />
              <circle cx="12" cy="12" r="4" /><path d="M12 8v-2" /><path d="M12 18v-2" />
            </svg>
          </div>
          <span className="nav-logo-text">Nourish<span>AI</span></span>
        </Link>

        {/* Center tabs */}
        <div className="nav-tabs">
          <Link to="/" className={`nav-tab${isActive('/') ? ' active' : ''}`}>Planner</Link>
          {user && (
            <>
              <Link to="/history" className={`nav-tab${isActive('/history') ? ' active' : ''}`}>My Plans</Link>
              <Link to="/shopping" className={`nav-tab${isActive('/shopping') ? ' active' : ''}`}>Shopping List</Link>
            </>
          )}
        </div>

        {/* Right side */}
        <div className="nav-right">
          {user ? (
            <div className="nav-user-wrap" ref={dropRef}>
              <button
                className={`nav-user-btn${open ? ' open' : ''}`}
                onClick={() => setOpen(o => !o)}
              >
                <span className="nav-avatar">{user.name.charAt(0).toUpperCase()}</span>
                <span>{user.name.split(' ')[0]}</span>
                <span className="nav-caret">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>

              {open && (
                <div className="nav-dropdown">
                  <div className="nav-dropdown-header">
                    <div className="nav-dropdown-name">{user.name}</div>
                    <div className="nav-dropdown-email">{user.email || 'Diet planner member'}</div>
                  </div>
                  <Link to="/history" className="nav-dropdown-item" onClick={() => setOpen(false)}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h6l3 9 3-6h6"/><path d="M3 21h18"/></svg>
                    My Plans
                  </Link>
                  <div className="nav-dropdown-divider" />
                  <button className="nav-dropdown-item danger" onClick={handleLogout}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-btn-filled">Get started</Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
