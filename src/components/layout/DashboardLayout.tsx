import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  FileText,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'ダッシュボード', path: '/', icon: LayoutDashboard },
    { name: '現場管理', path: '/projects', icon: FileText },
    { name: '人材・日当設定', path: '/staff', icon: Users },
    { name: '請求タイムライン', path: '/timeline', icon: Clock },
  ];

  return (
    <div className="flex tech-grid min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-dashboard-line h-screen sticky top-0 p-6 flex flex-col gap-8 bg-dashboard-bg">
        <div className="text-2xl font-bold tracking-tighter italic">CONSTRUX</div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path}
                to={item.path} 
                className={cn(
                  "flex items-center gap-3 p-2 transition-colors rounded text-sm font-medium",
                  isActive 
                    ? "bg-dashboard-ink text-dashboard-bg" 
                    : "hover:bg-dashboard-ink/10"
                )}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-dashboard-line">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 p-2 w-full hover:bg-red-500/10 text-red-600 transition-colors rounded text-sm font-medium"
          >
            <LogOut size={18} />
            <span>ログアウト</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
};
