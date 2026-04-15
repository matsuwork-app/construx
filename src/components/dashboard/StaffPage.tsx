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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Edit2, Save, X, Briefcase, Loader2, Trash2 } from 'lucide-react';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Role = 'president' | 'admin' | 'foreman' | 'worker';

interface EditState {
  full_name: string;
  role: Role;
  daily_rate: number;
}

const defaultAddState: EditState = { full_name: '', role: 'worker', daily_rate: 0 };

export const StaffPage: React.FC = () => {
  const { profiles, projects, loading, refetch } = useSupabaseData();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ full_name: '', role: 'worker', daily_rate: 0 });
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [addState, setAddState] = useState<EditState>(defaultAddState);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredProfiles = profiles.filter(m => {
    const q = searchQuery.toLowerCase();
    const roleLabel = roleToLabel(m.role).toLowerCase();
    return m.full_name.toLowerCase().includes(q) || roleLabel.includes(q);
  });

  const handleEditStart = (member: typeof profiles[number]) => {
    setEditingId(member.id);
    setEditState({ full_name: member.full_name, role: member.role, daily_rate: member.daily_rate });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase.from('staff_members').update({
      full_name: editState.full_name,
      role: editState.role,
      daily_rate: editState.daily_rate,
    }).eq('id', id);
    if (error) {
      toast.error('保存に失敗しました');
    } else {
      toast.success('スタッフ情報を更新しました');
      setEditingId(null);
      refetch();
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from('staff_members').delete().eq('id', id);
    setDeletingId(null);
    if (error) {
      toast.error('削除に失敗しました');
    } else {
      toast.success('スタッフを削除しました');
      refetch();
    }
  };

  const handleAdd = async () => {
    if (!addState.full_name.trim()) {
      toast.error('名前を入力してください');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('staff_members').insert({
      full_name: addState.full_name.trim(),
      role: addState.role,
      daily_rate: addState.daily_rate,
    });
    setAdding(false);
    if (error) {
      toast.error('スタッフの追加に失敗しました');
    } else {
      toast.success('スタッフを追加しました');
      setIsAddStaffOpen(false);
      setAddState(defaultAddState);
      refetch();
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'president': return <Badge className="bg-purple-100 text-purple-800 border-purple-200">社長</Badge>;
      case 'admin': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">事務</Badge>;
      case 'foreman': return <Badge className="bg-orange-100 text-orange-800 border-orange-200">親方</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800 border-gray-200">作業員</Badge>;
    }
  };

  const getAssignedProjects = (staffId: string) => {
    return projects.filter(p => p.assignments.some(a => a.user_id === staffId));
  };

  if (loading && profiles.length === 0) {
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
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-dashboard-ink">Staff Management</h1>
            <p className="text-sm text-muted-foreground">人材DB・日当設定</p>
          </div>
          <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
            <DialogTrigger render={
              <Button className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 rounded-md gap-2 shadow-sm" />
            }>
              <UserPlus size={18} />
              スタッフ追加
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>スタッフを追加する</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <Label htmlFor="add-name">名前</Label>
                  <Input
                    id="add-name"
                    value={addState.full_name}
                    onChange={(e) => setAddState({ ...addState, full_name: e.target.value })}
                    placeholder="山田 太郎"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-role">ロール</Label>
                  <Select value={addState.role} onValueChange={(value: Role) => setAddState({ ...addState, role: value })}>
                    <SelectTrigger id="add-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">作業員</SelectItem>
                      <SelectItem value="foreman">親方</SelectItem>
                      <SelectItem value="admin">事務</SelectItem>
                      <SelectItem value="president">社長</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-rate">日当 (円)</Label>
                  <Input
                    id="add-rate"
                    type="number"
                    value={addState.daily_rate}
                    onChange={(e) => setAddState({ ...addState, daily_rate: Number(e.target.value) })}
                    placeholder="20000"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddStaffOpen(false)}>キャンセル</Button>
                <Button
                  onClick={handleAdd}
                  disabled={adding || !addState.full_name.trim()}
                  className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 gap-2"
                >
                  {adding ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  追加
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        <div className="flex gap-4 items-center bg-white p-4 border border-dashboard-line rounded-xl shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              className="pl-10 bg-transparent border-dashboard-line rounded-md"
              placeholder="名前やロールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="border border-dashboard-line bg-white rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="border-dashboard-line hover:bg-transparent">
                <TableHead className="font-bold text-dashboard-ink">名前</TableHead>
                <TableHead className="font-bold text-dashboard-ink">ロール</TableHead>
                <TableHead className="font-bold text-dashboard-ink">日当 (円)</TableHead>
                <TableHead className="font-bold text-dashboard-ink">担当現場</TableHead>
                <TableHead className="font-bold text-dashboard-ink text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchQuery ? '検索結果がありません。' : 'スタッフが登録されていません。'}
                  </TableCell>
                </TableRow>
              )}
              {filteredProfiles.map((member) => {
                const assignedProjects = getAssignedProjects(member.id);
                const isEditing = editingId === member.id;
                return (
                  <TableRow key={member.id} className="border-dashboard-line hover:bg-slate-50 transition-colors">
                    <TableCell className="font-medium">
                      {isEditing ? (
                        <Input
                          value={editState.full_name}
                          onChange={(e) => setEditState({ ...editState, full_name: e.target.value })}
                          className="w-36 h-8 rounded-md border-dashboard-line bg-white"
                        />
                      ) : member.full_name}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={editState.role} onValueChange={(value: Role) => setEditState({ ...editState, role: value })}>
                          <SelectTrigger className="w-28 h-8 rounded-md">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="worker">作業員</SelectItem>
                            <SelectItem value="foreman">親方</SelectItem>
                            <SelectItem value="admin">事務</SelectItem>
                            <SelectItem value="president">社長</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : getRoleBadge(member.role)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editState.daily_rate}
                          onChange={(e) => setEditState({ ...editState, daily_rate: Number(e.target.value) })}
                          className="w-32 h-8 rounded-md border-dashboard-line bg-white"
                        />
                      ) : (
                        `¥${Number(member.daily_rate).toLocaleString()}`
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {assignedProjects.length > 0 ? (
                          assignedProjects.map(p => (
                            <Badge key={p.id} variant="outline" className="text-xs border-dashboard-line bg-white rounded-full">
                              <Briefcase size={10} className="mr-1" />
                              {p.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">アサインなし</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-8 w-8 p-0 rounded-md">
                            <X size={16} />
                          </Button>
                          <Button size="sm" className="bg-[var(--dashboard-accent)] text-white h-8 w-8 p-0 rounded-md" onClick={() => handleSave(member.id)}>
                            <Save size={16} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEditStart(member)} className="h-8 w-8 p-0 rounded-md">
                            <Edit2 size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(member.id)}
                            disabled={deletingId === member.id}
                            className="h-8 w-8 p-0 rounded-md text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            {deletingId === member.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
      </div>
    </DashboardLayout>
  );
};

function roleToLabel(role: string): string {
  switch (role) {
    case 'president': return '社長';
    case 'admin': return '事務';
    case 'foreman': return '親方';
    default: return '作業員';
  }
}
