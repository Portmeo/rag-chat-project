import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';

export default function Sidebar() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="sidebar-backdrop" onClick={toggleMobileSidebar} />
      )}

      {/* Mobile toggle button */}
      <button className="mobile-sidebar-toggle" onClick={toggleMobileSidebar}>
        ☰
      </button>

      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-toggle" onClick={toggleSidebar}>
            ☰
          </button>
          {!isCollapsed && (
            <div className="sidebar-title">
              <h2>RAG Chat</h2>
              <p>Technical Docs</p>
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/chat"
            className={`nav-item ${location.pathname === '/chat' ? 'active' : ''}`}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Chat</span>
          </Link>
          <Link
            to="/upload"
            className={`nav-item ${location.pathname === '/upload' ? 'active' : ''}`}
          >
            <span className="nav-icon">📤</span>
            <span className="nav-label">Upload</span>
          </Link>
        </nav>
      </aside>
    </>
  );
}
