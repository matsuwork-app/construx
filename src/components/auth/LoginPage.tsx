import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { session, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-bg">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません。');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dashboard-bg tech-grid">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl font-bold tracking-tighter italic mb-2">CONSTRUX</div>
          <p className="text-sm opacity-60">建設現場工程・請求管理システム</p>
        </div>

        <Card className="rounded-none border-dashboard-line bg-white/50 shadow-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold">ログイン</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs tech-header">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="rounded-none border-dashboard-line"
                  placeholder="example@construx.jp"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs tech-header">パスワード</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="rounded-none border-dashboard-line"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 border border-red-200 bg-red-50 text-red-700 text-sm">
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-none"
              >
                {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                {loading ? 'ログイン中...' : 'ログイン'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
