import { Link, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <div>
            <h1>RAG Chat - Technical Docs</h1>
            <p>Upload documents and ask questions</p>
          </div>

          <nav className="nav-links">
            <Link
              to="/chat"
              className={location.pathname === '/chat' ? 'active' : ''}
            >
              💬 Chat
            </Link>
            <Link
              to="/upload"
              className={location.pathname === '/upload' ? 'active' : ''}
            >
              📤 Upload
            </Link>
          </nav>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
