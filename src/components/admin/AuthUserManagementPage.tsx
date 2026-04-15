import React, { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Search, Edit2, Save, X, Loader2, Info } from 'lucide-react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const AuthUserManagementPage: React.FC = () => {
  const { authUsers, loading, refetch } = useSupabaseData();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredUsers = authUsers.filter(u =>
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditStart = (user: typeof authUsers[number]) => {
    setEditingId(user.id);
    setEditDisplayName(user.display_name);
  };

  const handleSave = async (id: string) => {
    if (!editDisplayName.trim()) {
      toast.error('Display Name を入力してください');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('auth_user_metadata')
      .update({ display_name: editDisplayName.trim() })
      .eq('id', id);
    setSaving(false);
    if (error) {
      toast.error('保存に失敗しました');
    } else {
      toast.success('Display Name を更新しました');
      setEditingId(null);
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    // auth_user_metadata から削除（auth.users は Supabase Dashboard から削除）
    const { error } = await supabase
      .from('auth_user_metadata')
      .delete()
      .eq('id', id);
    setDeleting(false);
    if (error) {
      toast.error('削除に失敗しました');
    } else {
      toast.success('ユーザーメタデータを削除しました');
      setDeleteConfirmId(null);
      refetch();
    }
  };

  if (loading && authUsers.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-dashboard-ink">認証ユーザー管理</h1>
          <p className="text-sm text-muted-foreground">Supabase Auth ユーザーの Display Name 管理</p>
        </header>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2 text-sm">
          <div className="flex items-center gap-2 font-bold text-blue-800">
            <Info size={16} />
            ユーザー削除について
          </div>
          <p className="text-blue-700 text-xs">
            ユーザーを完全に削除するには、Supabase Dashboard → Authentication → Users から削除してください。
            ここでは Display Name のみ管理できます。
          </p>
        </div>

        <div className="flex gap-4 items-center bg-white p-4 border border-dashboard-line rounded-xl shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="pl-10 bg-transparent border-dashboard-line rounded-md"
              placeholder="Display Name またはUID で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="border border-dashboard-line bg-white rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-dashboard-line hover:bg-transparent">
                <TableHead className="font-bold text-dashboard-ink">Display Name</TableHead>
                <TableHead className="font-bold text-dashboard-ink">UID</TableHead>
                <TableHead className="font-bold text-dashboard-ink">登録日時</TableHead>
                <TableHead className="font-bold text-dashboard-ink text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    {searchQuery ? '検索結果がありません。' : 'ユーザーがいません。'}
                  </TableCell>
                </TableRow>
              )}
              {filteredUsers.map((user) => {
                const isEditing = editingId === user.id;
                return (
                  <TableRow key={user.id} className="border-dashboard-line hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          className="w-56 h-8 rounded-md border-dashboard-line bg-white"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(user.id); }}
                        />
                      ) : (
                        user.display_name
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {user.id}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleString('ja-JP')}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                            className="h-8 w-8 p-0 rounded-md"
                          >
                            <X size={16} />
                          </Button>
                          <Button
                            size="sm"
                            className="bg-[var(--dashboard-accent)] text-white h-8 w-8 p-0 rounded-md"
                            onClick={() => handleSave(user.id)}
                            disabled={saving}
                          >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditStart(user)}
                            className="h-8 w-8 p-0 rounded-md"
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteConfirmId(user.id)}
                            className="h-8 w-8 p-0 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X size={16} />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* 削除確認ダイアログ */}
        <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ユーザーメタデータを削除しますか？</DialogTitle>
              <DialogDescription>
                このアクションは取り消せません。Supabase Dashboard から auth.users も削除してください。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>キャンセル</Button>
              <Button
                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                削除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};
