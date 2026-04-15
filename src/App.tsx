import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import {
  Users,
  FileText,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StaffPage } from '@/components/dashboard/StaffPage';
import { ProjectsPage } from '@/components/dashboard/ProjectsPage';
import { TimelinePage } from '@/components/dashboard/TimelinePage';
import { LoginPage } from '@/components/auth/LoginPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { differenceInDays } from 'date-fns';

// 認証済みルートを保護するコンポーネント (ログイン後に元のページへ戻る)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
};

const HomePage = () => {
  const { projects, profiles, loading } = useSupabaseData();

  const activeProjectsCount = projects.filter(p => p.status === 'active').length;
  const totalCost = projects.reduce((sum, p) => {
    const expensesTotal = p.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return sum + expensesTotal;
  }, 0);
  const staffCount = profiles.length;

  const upcomingDeadlines = projects.filter(p => {
    if (!p.deadline) return false;
    const days = differenceInDays(new Date(p.deadline), new Date());
    return days >= 0 && days <= 7;
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm opacity-60 italic serif">Construx Management System</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="rounded-none border-dashboard-line bg-white/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="tech-header flex items-center gap-2">
                <FileText size={14} />
                稼働中の現場
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tech-value">{loading ? '-' : activeProjectsCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-dashboard-line bg-white/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="tech-header flex items-center gap-2">
                <TrendingUp size={14} />
                概算原価合計
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tech-value">{loading ? '-' : `¥${totalCost.toLocaleString()}`}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-dashboard-line bg-white/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="tech-header flex items-center gap-2">
                <Users size={14} />
                登録スタッフ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tech-value">{loading ? '-' : staffCount}</div>
            </CardContent>
          </Card>
          <Card className="rounded-none border-dashboard-line bg-white/50 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="tech-header flex items-center gap-2 text-red-600">
                <AlertCircle size={14} />
                期限間近 (7日以内)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold tech-value text-red-600">{loading ? '-' : upcomingDeadlines.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-none border-dashboard-line bg-white/30 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold">請求アラート</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingDeadlines.length === 0 && !loading ? (
              <div className="text-sm text-muted-foreground p-3">期限間近のプロジェクトはありません。</div>
            ) : (
              upcomingDeadlines.map((project) => {
                const days = differenceInDays(new Date(project.deadline!), new Date());
                const deadlineText = days === 0 ? '今日' : days === 1 ? '明日' : `${days}日後`;
                const margin = project.target_profit_margin || 0.2;
                const cost = project.expenses.reduce((s, e) => s + Number(e.amount), 0);
                const invoiceAmount = margin >= 1 ? cost : Math.round(cost / (1 - margin));

                return (
                  <div key={project.id} className="flex justify-between items-center p-3 border border-red-200 bg-red-50">
                    <div>
                      <p className="text-sm font-bold">{project.name}</p>
                      <p className="text-xs text-red-600 font-bold">期限: {deadlineText}</p>
                    </div>
                    <span className="tech-value font-bold">¥{invoiceAmount.toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <Router>
          <div className="min-h-screen bg-dashboard-bg font-sans antialiased">
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
              <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
              <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
              <Route path="/timeline" element={<ProtectedRoute><TimelinePage /></ProtectedRoute>} />
            </Routes>
            <Toaster />
          </div>
        </Router>
      </TooltipProvider>
    </AuthProvider>
  );
}
