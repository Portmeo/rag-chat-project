import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, MessageSquare, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleMobileSidebar}
        />
      )}

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={toggleMobileSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <aside
        className={cn(
          'fixed md:relative h-full bg-card border-r border-border z-50 transition-all duration-300 overflow-hidden',
          'flex flex-col',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        <div className={cn(
          "flex items-center border-b border-border transition-all duration-300",
          isCollapsed ? "justify-center p-2" : "justify-between p-4"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="hidden md:flex shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {!isCollapsed && (
            <div className="flex-1 ml-2 animate-in fade-in">
              <h2 className="text-lg font-semibold whitespace-nowrap">RAG Chat</h2>
              <p className="text-sm text-muted-foreground whitespace-nowrap">Technical Docs</p>
            </div>
          )}
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <Link to="/chat">
            <Button
              variant={location.pathname === '/chat' ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <MessageSquare className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <span className="ml-2 transition-opacity duration-300 whitespace-nowrap animate-in fade-in">
                  Chat
                </span>
              )}
            </Button>
          </Link>
          <Link to="/upload">
            <Button
              variant={location.pathname === '/upload' ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <Upload className="h-5 w-5 shrink-0" />
              {!isCollapsed && (
                <span className="ml-2 transition-opacity duration-300 whitespace-nowrap animate-in fade-in">
                  Upload
                </span>
              )}
            </Button>
          </Link>
        </nav>
      </aside>
    </>
  );
}
