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
    { name: '人材', path: '/staff', icon: Users },
    { name: 'タイムライン', path: '/timeline', icon: Clock },
  ];

  return (
    <div className="flex tech-grid min-h-screen">

      {/* ── PC サイドバー (md 以上のみ表示) ── */}
      <aside className="hidden md:flex w-64 border-r border-dashboard-line h-screen sticky top-0 p-6 flex-col gap-8 bg-dashboard-bg shrink-0">
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

      {/* ── メインコンテンツ ── */}
      {/* モバイルはボトムナビ分の余白を追加 */}
      <main className="flex-1 min-w-0 overflow-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* ── モバイル ボトムナビ (md 未満のみ表示) ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-dashboard-bg border-t border-dashboard-line">
        <div className="flex items-center justify-around px-2 py-1 safe-area-bottom">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[60px]",
                  isActive
                    ? "text-dashboard-ink"
                    : "text-muted-foreground"
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={cn(
                  "text-[10px] font-medium leading-tight",
                  isActive ? "text-dashboard-ink" : "text-muted-foreground"
                )}>
                  {item.name}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-dashboard-ink mt-0.5" />
                )}
              </Link>
            );
          })}
          {/* ログアウトボタン */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[60px] text-red-400"
          >
            <LogOut size={22} strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-tight">ログアウト</span>
          </button>
        </div>
      </nav>

    </div>
  );
};
