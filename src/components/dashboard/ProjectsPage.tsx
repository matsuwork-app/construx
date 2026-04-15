import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DatePicker } from '@/components/ui/date-picker';
import {
  Calculator,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Users,
  MapPin,
  Check,
  X,
  Loader2,
  Save,
  Search,
  HardHat,
  Package,
  Percent,
  Receipt
} from 'lucide-react';
import { useSupabaseData, ProjectData } from '@/lib/useSupabaseData';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { format, differenceInDays, parseISO } from 'date-fns';

export const ProjectsPage: React.FC = () => {
  const { projects, profiles, loading, refetch } = useSupabaseData();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  const [isAssignComboboxOpen, setIsAssignComboboxOpen] = useState(false); // 既存プロジェクト用
  const [newProjectStaffSearch, setNewProjectStaffSearch] = useState(''); // 新規登録Sheet内検索
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: '', amount: 0 });

  // インライン編集用の state
  const [editingName, setEditingName] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingOrderAmount, setEditingOrderAmount] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editOrderAmount, setEditOrderAmount] = useState(0);

  // 請求シミュレーション用の粗利率 (%)
  const [laborMarginPct, setLaborMarginPct] = useState(20);
  const [expenseMarginPct, setExpenseMarginPct] = useState(20);

  // 人材コスト シミュレーション上書き値 (人材DBには反映しない)
  // 構造: { [projectId]: { [userId]: { daily_rate, total_hours } } }
  // 一度初期化したプロジェクトは refetch でも上書きしない
  const [laborOverrides, setLaborOverrides] = useState<
    Record<string, Record<string, { daily_rate: number; total_hours: number }>>
  >({});

  // 現場切替 or データロード時: 粗利率リセット & 未初期化プロジェクトのみ初期化
  useEffect(() => {
    const p = projects.find(x => x.id === selectedId);
    if (!p) return;

    // 粗利率は DB の値を常に反映
    const pct = Math.round(p.target_profit_margin * 100);
    setLaborMarginPct(pct);
    setExpenseMarginPct(pct);

    // オーバーライドは「このプロジェクトが未初期化の場合のみ」セットする
    // → refetch で projects が更新されても編集済みの値を保持できる
    setLaborOverrides(prev => {
      if (prev[p.id]) return prev; // 既に初期化済み → 変更しない
      const init: Record<string, { daily_rate: number; total_hours: number }> = {};
      p.assignments.forEach(a => {
        const profile = profiles.find(pr => pr.id === a.user_id);
        if (profile) {
          init[a.user_id] = { daily_rate: profile.daily_rate, total_hours: 0 };
        }
      });
      return { ...prev, [p.id]: init };
    });
  }, [selectedId, projects]);

  // New Project Form State
  const [newProject, setNewProject] = useState<Partial<ProjectData>>({
    name: '',
    address: '',
    received_date: '',
    start_date: '',
    planned_end_date: '',
    deadline: '',
    total_order_amount: 0,
    target_profit_margin: 0.2,
    assignments: []
  });

  // Automatically select the first project if none is selected and data is loaded
  useEffect(() => {
    if (!selectedId && projects.length > 0) {
      setSelectedId(projects[0].id);
    }
  }, [projects, selectedId]);

  const selectedProject = projects.find(p => p.id === selectedId);

  // ── 請求計算ヘルパー ──────────────────────────────────────────
  /** アサイン済みメンバーごとの人材コスト内訳を計算 (laborOverrides があれば優先) */
  const getStaffLaborBreakdown = (project: ProjectData) => {
    const projectOverrides = laborOverrides[project.id] ?? {};
    return project.assignments.map(assignment => {
      const profile = profiles.find(p => p.id === assignment.user_id);
      if (!profile) return null;
      const override = projectOverrides[assignment.user_id];
      const daily_rate = override?.daily_rate ?? profile.daily_rate;
      const totalHours = override?.total_hours ?? 0;
      const cost = Math.round((daily_rate / 8) * totalHours);
      return { user_id: assignment.user_id, full_name: profile.full_name, daily_rate, totalHours, cost };
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  };

  /** 人材コスト合計 */
  const getLaborTotal = (project: ProjectData) =>
    getStaffLaborBreakdown(project).reduce((sum, s) => sum + s.cost, 0);

  /** その他経費合計 */
  const getExpensesTotal = (project: ProjectData) =>
    project.expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  /** 粗利率(%)を適用した請求額 (原価 ÷ (1 - 粗利率)) */
  const applyMargin = (cost: number, marginPct: number): number => {
    const m = Math.min(99, Math.max(0, marginPct)) / 100;
    return cost === 0 ? 0 : Math.round(cost / (1 - m));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">進行中</Badge>;
      case 'completed': return <Badge className="bg-gray-100 text-gray-800 border-gray-200">完了</Badge>;
      case 'invoiced': return <Badge className="bg-green-100 text-green-800 border-green-200">請求済</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">待機中</Badge>;
    }
  };

  const handleAddExpense = async () => {
    if (!selectedProject || !newExpense.category) return;
    const { error } = await supabase.from('project_expenses').insert({
      project_id: selectedProject.id,
      category: newExpense.category,
      amount: newExpense.amount,
      expense_date: new Date().toISOString().split('T')[0]
    });
    if (!error) {
      setIsExpenseDialogOpen(false);
      setNewExpense({ category: '', amount: 0 });
      refetch();
    }
  };

  const handleUpdateExpense = async (expId: string, field: 'category' | 'amount', value: string | number) => {
    const updateData = field === 'category' ? { category: value as string } : { amount: value as number };
    await supabase.from('project_expenses').update(updateData).eq('id', expId);
    refetch();
  };

  const handleRemoveExpense = async (expId: string) => {
    await supabase.from('project_expenses').delete().eq('id', expId);
    refetch();
  };

  const handleUpdateDate = async (field: 'received_date' | 'start_date' | 'planned_end_date' | 'deadline', value: string) => {
    if (!selectedProject) return;
    const updateData = { [field]: value || null } as Record<string, string | null>;
    const { error } = await supabase.from('projects').update(updateData).eq('id', selectedProject.id);
    if (!error) refetch();
  };

  const handleToggleStaff = async (staffId: string) => {
    if (!selectedProject) return;
    const assignment = selectedProject.assignments.find(a => a.user_id === staffId);
    if (assignment) {
      await supabase.from('project_assignments').delete().eq('id', assignment.id);
    } else {
      await supabase.from('project_assignments').insert({
        project_id: selectedProject.id,
        user_id: staffId
      });
    }
    refetch();
  };

  const handleCreateProject = async () => {
    const { data: newProjData, error } = await supabase.from('projects').insert({
      name: newProject.name || '新規プロジェクト',
      address: newProject.address || null,
      status: 'pending',
      total_order_amount: newProject.total_order_amount || 0,
      target_profit_margin: newProject.target_profit_margin || 0.2,
      received_date: newProject.received_date || null,
      start_date: newProject.start_date || null,
      planned_end_date: newProject.planned_end_date || null,
      deadline: newProject.deadline || null,
    }).select().single();

    if (error) { toast.error('現場の登録に失敗しました'); return; }

    if (newProjData && newProject.assignments && newProject.assignments.length > 0) {
      const assignmentsToInsert = newProject.assignments.map(a => ({
        project_id: newProjData.id,
        user_id: a.user_id
      }));
      await supabase.from('project_assignments').insert(assignmentsToInsert);
    }

    setIsNewProjectOpen(false);
    setNewProject({ name: '', address: '', received_date: '', start_date: '', planned_end_date: '', deadline: '', total_order_amount: 0, target_profit_margin: 0.2, assignments: [] });
    setNewProjectStaffSearch('');
    await refetch();
    if (newProjData) setSelectedId(newProjData.id);
  };


  const handleUpdateStatus = async (status: 'pending' | 'active' | 'completed' | 'invoiced') => {
    if (!selectedProject) return;
    await supabase.from('projects').update({ status }).eq('id', selectedProject.id);
    refetch();
  };

  const handleSaveName = async () => {
    if (!selectedProject || !editName.trim()) return;
    const { error } = await supabase.from('projects').update({ name: editName.trim() }).eq('id', selectedProject.id);
    if (error) { toast.error('現場名の保存に失敗しました'); } else { toast.success('現場名を更新しました'); refetch(); }
    setEditingName(false);
  };

  const handleSaveAddress = async () => {
    if (!selectedProject) return;
    const { error } = await supabase.from('projects').update({ address: editAddress.trim() || null }).eq('id', selectedProject.id);
    if (error) { toast.error('住所の保存に失敗しました'); } else { toast.success('住所を更新しました'); refetch(); }
    setEditingAddress(false);
  };

  const handleSaveOrderAmount = async () => {
    if (!selectedProject) return;
    const { error } = await supabase.from('projects').update({ total_order_amount: editOrderAmount }).eq('id', selectedProject.id);
    if (error) { toast.error('受注総額の保存に失敗しました'); } else { toast.success('受注総額を更新しました'); refetch(); }
    setEditingOrderAmount(false);
  };

  const handleConfirmInvoice = async () => {
    if (!selectedProject) return;
    const laborCost = getLaborTotal(selectedProject);
    const expensesCost = getExpensesTotal(selectedProject);
    const laborInvoice = applyMargin(laborCost, laborMarginPct);
    const expenseInvoice = applyMargin(expensesCost, expenseMarginPct);
    const invoiceAmount = laborInvoice + expenseInvoice;
    const totalCost = laborCost + expensesCost;
    const overallMargin = invoiceAmount > 0 ? (invoiceAmount - totalCost) / invoiceAmount : 0;

    const { error } = await supabase.from('projects').update({
      status: 'invoiced',
      final_invoice_amount: invoiceAmount,
      target_profit_margin: overallMargin,
    }).eq('id', selectedProject.id);
    if (error) {
      toast.error('請求金額の確定に失敗しました');
    } else {
      toast.success(`請求金額 ¥${invoiceAmount.toLocaleString()} を確定しました`);
      refetch();
    }
  };

  if (loading && projects.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--dashboard-accent)]" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-dashboard-ink">Project Management</h1>
            <p className="text-sm text-muted-foreground">現場管理・請求シミュレーション</p>
          </div>
          <Sheet open={isNewProjectOpen} onOpenChange={setIsNewProjectOpen}>
            <SheetTrigger render={
              <Button className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 rounded-md flex gap-2 shadow-sm" />
            }>
              <Plus size={16} />
              新規現場を登録
            </SheetTrigger>
            <SheetContent className="sm:max-w-[600px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-2xl font-bold">新規現場登録</SheetTitle>
                <SheetDescription>新しい現場の基本情報を入力してください。</SheetDescription>
              </SheetHeader>
              <div className="grid gap-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-bold text-sm">現場名</Label>
                  <Input id="name" value={newProject.name} onChange={e => setNewProject({...newProject, name: e.target.value})} className="rounded-md border-dashboard-line" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-sm">住所</Label>
                  <Input id="address" value={newProject.address || ''} onChange={e => setNewProject({...newProject, address: e.target.value})} className="rounded-md border-dashboard-line" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="orderAmount" className="font-bold text-sm">受注総額</Label>
                  <Input id="orderAmount" type="number" value={newProject.total_order_amount} onChange={e => setNewProject({...newProject, total_order_amount: Number(e.target.value)})} className="rounded-md border-dashboard-line" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">案件受付日</Label>
                    <DatePicker date={newProject.received_date || ''} setDate={(d) => setNewProject({...newProject, received_date: d})} className="rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">着工日</Label>
                    <DatePicker date={newProject.start_date || ''} setDate={(d) => setNewProject({...newProject, start_date: d})} className="rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm">完工予定日</Label>
                    <DatePicker date={newProject.planned_end_date || ''} setDate={(d) => setNewProject({...newProject, planned_end_date: d})} className="rounded-md" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-sm text-red-600">請求期限</Label>
                    <DatePicker date={newProject.deadline || ''} setDate={(d) => setNewProject({...newProject, deadline: d})} className="rounded-md border-red-200" />
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-dashboard-line">
                  <Label className="font-bold text-sm">担当メンバー初期アサイン</Label>
                  <div className="border border-dashboard-line rounded-md overflow-hidden">
                    <div className="flex items-center border-b border-dashboard-line px-3 bg-white">
                      <Search size={14} className="text-muted-foreground mr-2 shrink-0" />
                      <input
                        type="text"
                        placeholder="担当者を検索..."
                        value={newProjectStaffSearch}
                        onChange={e => setNewProjectStaffSearch(e.target.value)}
                        className="w-full py-2 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {profiles.filter(s => s.full_name.toLowerCase().includes(newProjectStaffSearch.toLowerCase())).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">担当者が見つかりません。</p>
                      )}
                      {profiles
                        .filter(s => s.full_name.toLowerCase().includes(newProjectStaffSearch.toLowerCase()))
                        .map((staff) => {
                          const isAssigned = newProject.assignments?.some(a => a.user_id === staff.id);
                          return (
                            <button
                              key={staff.id}
                              type="button"
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors hover:bg-slate-50",
                                isAssigned && "bg-blue-50"
                              )}
                              onClick={() => {
                                const currentAssignments = newProject.assignments || [];
                                if (isAssigned) {
                                  setNewProject({ ...newProject, assignments: currentAssignments.filter(a => a.user_id !== staff.id) });
                                } else {
                                  setNewProject({ ...newProject, assignments: [...currentAssignments, { user_id: staff.id } as any] });
                                }
                              }}
                            >
                              <div className={cn(
                                "flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors",
                                isAssigned ? "bg-[var(--dashboard-accent)] border-[var(--dashboard-accent)]" : "border-gray-300"
                              )}>
                                {isAssigned && <Check size={10} className="text-white" />}
                              </div>
                              <span className="font-medium">{staff.full_name}</span>
                              <span className="text-muted-foreground text-xs ml-auto">{staff.role}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newProject.assignments?.map(assignment => {
                      const staff = profiles.find(p => p.id === assignment.user_id);
                      if (!staff) return null;
                      return (
                        <Badge key={staff.id} variant="default" className="bg-[var(--dashboard-accent)] text-white">
                          {staff.full_name}
                          <X 
                            className="ml-1 h-3 w-3 cursor-pointer" 
                            onClick={() => {
                              setNewProject({
                                ...newProject,
                                assignments: newProject.assignments?.filter(a => a.user_id !== staff.id)
                              });
                            }}
                          />
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </div>
              <SheetFooter>
                <Button variant="outline" onClick={() => setIsNewProjectOpen(false)} className="rounded-md border-dashboard-line">キャンセル</Button>
                <Button onClick={handleCreateProject} className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 rounded-md">登録する</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Project List */}
          <div className="lg:col-span-1 space-y-4">
            <h3 className="font-bold text-dashboard-ink">現場一覧</h3>
            <div className="space-y-2">
              {projects.length === 0 && !loading && (
                <div className="p-4 text-center text-muted-foreground border border-dashed border-dashboard-line rounded-xl">
                  現場がありません。新規登録してください。
                </div>
              )}
              {projects.map(p => (
                <div 
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`p-4 border border-dashboard-line rounded-xl cursor-pointer transition-all shadow-sm ${
                    selectedId === p.id ? 'bg-[var(--dashboard-accent)] text-white border-transparent' : 'bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-sm">{p.name}</span>
                    {getStatusBadge(p.status)}
                  </div>
                  <div className="flex justify-between text-xs opacity-80">
                    <span>期限: {p.deadline ? format(parseISO(p.deadline), 'yyyy/MM/dd') : '未定'}</span>
                    <span className="font-mono">¥{Number(p.total_order_amount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Simulation Area */}
          <div className="lg:col-span-2 space-y-6">
            {selectedProject ? (
              <>
                <Card className="rounded-xl border-dashboard-line bg-white shadow-sm">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-4 space-y-1">
                        {editingName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                              className="text-2xl font-bold h-9 border-dashboard-line"
                            />
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveName}><Save size={16} /></Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingName(false)}><X size={16} /></Button>
                          </div>
                        ) : (
                          <CardTitle
                            className="text-2xl mb-1 text-dashboard-ink cursor-pointer hover:underline decoration-dashed"
                            onClick={() => { setEditName(selectedProject.name); setEditingName(true); }}
                            title="クリックして編集"
                          >
                            {selectedProject.name}
                          </CardTitle>
                        )}
                        {editingAddress ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              autoFocus
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveAddress(); if (e.key === 'Escape') setEditingAddress(false); }}
                              className="text-xs h-7 border-dashboard-line"
                              placeholder="住所を入力..."
                            />
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={handleSaveAddress}><Save size={14} /></Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingAddress(false)}><X size={14} /></Button>
                          </div>
                        ) : (
                          <div
                            className="flex items-center text-xs text-muted-foreground mt-1 cursor-pointer hover:text-dashboard-ink"
                            onClick={() => { setEditAddress(selectedProject.address || ''); setEditingAddress(true); }}
                            title="クリックして編集"
                          >
                            <MapPin size={12} className="mr-1" />
                            {selectedProject.address || <span className="italic">住所を追加...</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          className="text-sm border-dashboard-line rounded-md p-1 bg-white"
                          value={selectedProject.status}
                          onChange={(e) => handleUpdateStatus(e.target.value as any)}
                        >
                          <option value="pending">待機中</option>
                          <option value="active">進行中</option>
                          <option value="completed">完了</option>
                          <option value="invoiced">請求済</option>
                        </select>
                        {getStatusBadge(selectedProject.status)}
                      </div>
                    </div>
                    <CardDescription>プロジェクト詳細・シミュレーション</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    
                    {/* Dates Section */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 border border-dashboard-line rounded-lg bg-slate-50">
                      <div className="space-y-1">
                        <label className="font-bold text-xs text-dashboard-ink block">案件受付日</label>
                        <DatePicker date={selectedProject.received_date || ''} setDate={(d) => handleUpdateDate('received_date', d)} className="h-9 text-xs rounded-md bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-xs text-dashboard-ink block">着工日</label>
                        <DatePicker date={selectedProject.start_date || ''} setDate={(d) => handleUpdateDate('start_date', d)} className="h-9 text-xs rounded-md bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-xs text-dashboard-ink block">完工予定日</label>
                        <DatePicker date={selectedProject.planned_end_date || ''} setDate={(d) => handleUpdateDate('planned_end_date', d)} className="h-9 text-xs rounded-md bg-white" />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-xs text-red-600 block">請求期限</label>
                        <DatePicker date={selectedProject.deadline || ''} setDate={(d) => handleUpdateDate('deadline', d)} className="h-9 text-xs rounded-md border-red-200 bg-white" />
                      </div>
                    </div>

                    {/* Assigned Staff Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users size={16} className="text-[var(--dashboard-accent)]" />
                          <label className="font-bold text-sm text-dashboard-ink block">担当メンバー</label>
                        </div>
                        
                        <Popover open={isAssignComboboxOpen} onOpenChange={setIsAssignComboboxOpen}>
                          <PopoverTrigger render={
                            <Button variant="outline" size="sm" className="h-8 gap-1 rounded-md" />
                          }>
                            <Plus size={14} />
                            追加
                          </PopoverTrigger>
                          <PopoverContent className="w-[200px] p-0" align="end">
                            <Command>
                              <CommandInput placeholder="メンバーを検索..." />
                              <CommandList>
                                <CommandEmpty>見つかりません。</CommandEmpty>
                                <CommandGroup>
                                  {profiles.map((staff) => {
                                    const isAssigned = selectedProject.assignments.some(a => a.user_id === staff.id);
                                    return (
                                      <CommandItem
                                        key={staff.id}
                                        value={staff.full_name}
                                        onSelect={() => {
                                          handleToggleStaff(staff.id);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            isAssigned ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        {staff.full_name}
                                      </CommandItem>
                                    );
                                  })}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      
                      <div className="p-4 border border-dashboard-line rounded-lg bg-slate-50 flex flex-wrap gap-2 min-h-[60px] items-center">
                        {selectedProject.assignments.length === 0 ? (
                          <span className="text-sm text-muted-foreground italic">担当者がアサインされていません</span>
                        ) : (
                          selectedProject.assignments.map(assignment => {
                            const staff = profiles.find(s => s.id === assignment.user_id);
                            if (!staff) return null;
                            return (
                              <Badge 
                                key={staff.id} 
                                variant="secondary"
                                className="rounded-full bg-white border border-dashboard-line shadow-sm px-3 py-1 flex items-center gap-1"
                              >
                                {staff.full_name}
                                <button 
                                  onClick={() => handleToggleStaff(staff.id)}
                                  className="ml-1 text-muted-foreground hover:text-red-500 transition-colors rounded-full p-0.5 hover:bg-slate-100"
                                >
                                  <X size={12} />
                                </button>
                              </Badge>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* ── 受注総額 ── */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50 border border-dashboard-line rounded-lg">
                      <span className="text-sm font-bold text-dashboard-ink whitespace-nowrap">受注総額 (予算)</span>
                      {editingOrderAmount ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            autoFocus
                            type="number"
                            value={editOrderAmount}
                            onChange={(e) => setEditOrderAmount(Number(e.target.value))}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveOrderAmount(); if (e.key === 'Escape') setEditingOrderAmount(false); }}
                            className="font-mono h-8 border-dashboard-line w-44"
                          />
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveOrderAmount}><Save size={15} /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingOrderAmount(false)}><X size={15} /></Button>
                        </div>
                      ) : (
                        <div
                          className="text-lg font-mono font-bold text-dashboard-ink cursor-pointer hover:underline decoration-dashed flex-1"
                          onClick={() => { setEditOrderAmount(Number(selectedProject.total_order_amount)); setEditingOrderAmount(true); }}
                          title="クリックして編集"
                        >
                          ¥{Number(selectedProject.total_order_amount).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* ── 原価内訳・請求シミュレーション ── */}
                    {(() => {
                      const staffBreakdown = getStaffLaborBreakdown(selectedProject);
                      const laborTotal = getLaborTotal(selectedProject);
                      const expensesTotal = getExpensesTotal(selectedProject);
                      const totalCost = laborTotal + expensesTotal;
                      const laborInvoice = applyMargin(laborTotal, laborMarginPct);
                      const expenseInvoice = applyMargin(expensesTotal, expenseMarginPct);
                      const totalInvoice = laborInvoice + expenseInvoice;
                      const overallMarginDisplay = totalInvoice > 0
                        ? Math.round((totalInvoice - totalCost) / totalInvoice * 100)
                        : 0;
                      const targetMarginDisplay = Math.round(selectedProject.target_profit_margin * 100);

                      return (
                        <div className="space-y-2">
                          <label className="font-bold text-sm text-dashboard-ink flex items-center gap-2">
                            <Calculator size={15} />
                            原価内訳・請求シミュレーション
                          </label>

                          <div className="border border-dashboard-line rounded-xl overflow-hidden bg-white shadow-sm">

                            {/* ── 人材コスト ── */}
                            <div className="p-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <HardHat size={15} className="text-orange-500" />
                                <span className="font-bold text-sm text-dashboard-ink">人材コスト</span>
                                <span className="ml-auto text-xs text-muted-foreground">実績工数 × 時間単価 (日当÷8h)</span>
                              </div>

                              {/* メンバー行 (編集可能) */}
                              <div className="space-y-0.5 pl-1">
                                {/* ヘッダー */}
                                {staffBreakdown.length > 0 && (
                                  <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground">
                                    <span className="w-28">氏名</span>
                                    <span className="w-28 text-center">日当 (円)</span>
                                    <span className="text-muted-foreground text-center w-6">/8h×</span>
                                    <span className="w-24 text-center">工数 (h)</span>
                                    <span className="ml-auto w-24 text-right">コスト</span>
                                  </div>
                                )}
                                {staffBreakdown.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic px-2 py-2">担当メンバーがアサインされていません</p>
                                ) : staffBreakdown.map(s => (
                                  <div key={s.user_id} className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-slate-50">
                                    <span className="w-28 text-sm font-medium text-dashboard-ink truncate shrink-0" title={s.full_name}>
                                      {s.full_name}
                                    </span>
                                    <Input
                                      type="number"
                                      min={0}
                                      value={laborOverrides[selectedProject.id]?.[s.user_id]?.daily_rate ?? s.daily_rate}
                                      onChange={e => setLaborOverrides(prev => ({
                                        ...prev,
                                        [selectedProject.id]: {
                                          ...prev[selectedProject.id],
                                          [s.user_id]: {
                                            ...prev[selectedProject.id]?.[s.user_id],
                                            daily_rate: Math.max(0, Number(e.target.value))
                                          }
                                        }
                                      }))}
                                      className="w-28 h-7 text-xs font-mono text-right rounded-md border-dashboard-line px-1 shrink-0"
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0 w-6 text-center">/8h×</span>
                                    <Input
                                      type="number"
                                      min={0}
                                      step={0.5}
                                      value={laborOverrides[selectedProject.id]?.[s.user_id]?.total_hours ?? s.totalHours}
                                      onChange={e => setLaborOverrides(prev => ({
                                        ...prev,
                                        [selectedProject.id]: {
                                          ...prev[selectedProject.id],
                                          [s.user_id]: {
                                            ...prev[selectedProject.id]?.[s.user_id],
                                            total_hours: Math.max(0, Number(e.target.value))
                                          }
                                        }
                                      }))}
                                      className="w-24 h-7 text-xs font-mono text-right rounded-md border-dashboard-line px-1 shrink-0"
                                    />
                                    <span className="text-xs text-muted-foreground shrink-0">h</span>
                                    <span className="font-mono text-sm ml-auto w-24 text-right font-bold text-dashboard-ink shrink-0">
                                      ¥{s.cost.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {staffBreakdown.length > 0 && (
                                <p className="text-xs text-muted-foreground pl-2 pt-0.5">
                                  ※ ここでの変更は人材DBの日当には反映されません
                                </p>
                              )}

                              {/* 小計 + 粗利率 */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-dashed border-dashboard-line">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">小計</span>
                                  <span className="font-mono font-bold text-sm">¥{laborTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <Percent size={13} className="text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">粗利率</span>
                                  <Input
                                    type="number"
                                    min={0} max={99}
                                    value={laborMarginPct}
                                    onChange={e => setLaborMarginPct(Math.min(99, Math.max(0, Number(e.target.value))))}
                                    className="w-16 h-7 text-xs text-center rounded-md border-dashboard-line px-1"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                  <span className="text-xs font-bold text-[var(--dashboard-accent)] ml-1 whitespace-nowrap">
                                    → ¥{laborInvoice.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="h-px bg-dashboard-line" />

                            {/* ── その他経費 ── */}
                            <div className="p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Package size={15} className="text-blue-500" />
                                  <span className="font-bold text-sm text-dashboard-ink">その他経費</span>
                                </div>
                                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                                  <DialogTrigger render={
                                    <Button size="sm" variant="outline" className="h-7 text-xs rounded-md bg-white gap-1" />
                                  }>
                                    <Plus size={12} /> 経費を追加
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                      <DialogTitle>経費の追加</DialogTitle>
                                      <DialogDescription>新しい経費項目（部材費、ガソリン代など）を追加します。</DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                      <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="expense-category" className="text-right">項目名</Label>
                                        <Input
                                          id="expense-category"
                                          value={newExpense.category}
                                          onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                          className="col-span-3"
                                          placeholder="例: ガソリン代"
                                        />
                                      </div>
                                      <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="expense-amount" className="text-right">金額 (円)</Label>
                                        <Input
                                          id="expense-amount"
                                          type="number"
                                          value={newExpense.amount}
                                          onChange={(e) => setNewExpense({ ...newExpense, amount: Number(e.target.value) })}
                                          className="col-span-3"
                                        />
                                      </div>
                                    </div>
                                    <DialogFooter>
                                      <Button variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>キャンセル</Button>
                                      <Button onClick={handleAddExpense} className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90">追加する</Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>

                              {/* 経費行 */}
                              <div className="space-y-1.5 pl-1">
                                {selectedProject.expenses.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">経費は登録されていません</p>
                                ) : selectedProject.expenses.map(exp => (
                                  <div key={exp.id} className="flex gap-2 items-center">
                                    <Input
                                      value={exp.category}
                                      onChange={(e) => handleUpdateExpense(exp.id, 'category', e.target.value)}
                                      onBlur={(e) => handleUpdateExpense(exp.id, 'category', e.target.value)}
                                      className="h-7 text-xs rounded-md bg-white flex-1"
                                    />
                                    <Input
                                      type="number"
                                      value={exp.amount}
                                      onChange={(e) => handleUpdateExpense(exp.id, 'amount', Number(e.target.value))}
                                      onBlur={(e) => handleUpdateExpense(exp.id, 'amount', Number(e.target.value))}
                                      className="h-7 text-xs rounded-md bg-white w-28 font-mono text-right"
                                    />
                                    <Button size="icon" variant="ghost" onClick={() => handleRemoveExpense(exp.id)} className="h-7 w-7 text-red-400 hover:bg-red-50 hover:text-red-600">
                                      <Trash2 size={13} />
                                    </Button>
                                  </div>
                                ))}
                              </div>

                              {/* 小計 + 粗利率 */}
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-dashed border-dashboard-line">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">小計</span>
                                  <span className="font-mono font-bold text-sm">¥{expensesTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 ml-auto">
                                  <Percent size={13} className="text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">粗利率</span>
                                  <Input
                                    type="number"
                                    min={0} max={99}
                                    value={expenseMarginPct}
                                    onChange={e => setExpenseMarginPct(Math.min(99, Math.max(0, Number(e.target.value))))}
                                    className="w-16 h-7 text-xs text-center rounded-md border-dashboard-line px-1"
                                  />
                                  <span className="text-xs text-muted-foreground">%</span>
                                  <span className="text-xs font-bold text-[var(--dashboard-accent)] ml-1 whitespace-nowrap">
                                    → ¥{expenseInvoice.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* ── 合計行 ── */}
                            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50/60 border-t-2 border-dashboard-line">
                              <div className="flex items-end justify-between gap-4">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-muted-foreground w-24">原価合計</span>
                                    <span className="font-mono font-bold text-dashboard-ink">¥{totalCost.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="text-muted-foreground w-24">粗利 (見込)</span>
                                    <span className={cn(
                                      "font-mono font-bold text-lg",
                                      overallMarginDisplay >= targetMarginDisplay ? "text-green-600" : "text-red-500"
                                    )}>
                                      {overallMarginDisplay}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">(目標 {targetMarginDisplay}%)</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1 justify-end">
                                    <Receipt size={13} />
                                    推奨請求金額
                                  </div>
                                  <div className="text-3xl font-bold font-mono text-dashboard-ink">
                                    ¥{totalInvoice.toLocaleString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── KPI カード ── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashboard-line">
                      <div className="p-4 border border-dashboard-line rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">
                          <TrendingUp size={14} />
                          受注額との差
                        </div>
                        <div className={cn(
                          "text-xl font-bold font-mono",
                          Number(selectedProject.total_order_amount) > 0
                            ? (Number(selectedProject.total_order_amount) - getLaborTotal(selectedProject) - getExpensesTotal(selectedProject) >= 0 ? "text-green-600" : "text-red-500")
                            : ""
                        )}>
                          {Number(selectedProject.total_order_amount) > 0
                            ? `¥${(Number(selectedProject.total_order_amount) - getLaborTotal(selectedProject) - getExpensesTotal(selectedProject)).toLocaleString()}`
                            : '—'}
                        </div>
                      </div>
                      <div className="p-4 border border-dashboard-line rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">
                          <Clock size={14} />
                          残り日数
                        </div>
                        <div className="text-xl font-bold font-mono">
                          {selectedProject.deadline
                            ? `${differenceInDays(parseISO(selectedProject.deadline), new Date())}日`
                            : '未設定'}
                        </div>
                      </div>
                      <div className="p-4 border border-dashboard-line rounded-lg bg-slate-50">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">
                          <AlertCircle size={14} />
                          予算消化率
                        </div>
                        <div className="text-xl font-bold font-mono">
                          {Number(selectedProject.total_order_amount) > 0
                            ? `${Math.round((getLaborTotal(selectedProject) + getExpensesTotal(selectedProject)) / Number(selectedProject.total_order_amount) * 100)}%`
                            : '—'}
                        </div>
                      </div>
                    </div>

                    {/* ── アクションボタン ── */}
                    <div className="flex justify-between items-center pt-2">
                      {selectedProject.final_invoice_amount && (
                        <div className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-md flex items-center gap-2">
                          <CheckCircle2 size={14} />
                          確定請求金額: <span className="font-bold font-mono">¥{Number(selectedProject.final_invoice_amount).toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex gap-4 ml-auto">
                        <Button
                          variant="outline"
                          className="rounded-md"
                          onClick={() => setSelectedId(null)}
                        >
                          閉じる
                        </Button>
                        <Button
                          onClick={handleConfirmInvoice}
                          disabled={selectedProject.status === 'invoiced'}
                          className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 rounded-md px-8 flex gap-2 shadow-sm disabled:opacity-60"
                        >
                          <CheckCircle2 size={18} />
                          {selectedProject.status === 'invoiced' ? '請求済み' : '請求金額を確定する'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-dashboard-line rounded-xl text-muted-foreground">
                現場を選択してください
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

