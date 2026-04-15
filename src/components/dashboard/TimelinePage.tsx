import React, { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Calendar, Filter, X, Loader2 } from 'lucide-react';
import { format, addDays, isAfter, isBefore, subMonths, addMonths, eachDayOfInterval, differenceInDays, startOfDay, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useSupabaseData } from '@/lib/useSupabaseData';

type StatusFilter = 'all' | 'pending' | 'active' | 'completed' | 'invoiced';
type DeadlineFilter = 'all' | '7days' | '30days' | 'overdue';

// プロジェクトごとのカラーパレット
const colorPalette = [
  'bg-blue-400',
  'bg-green-400',
  'bg-orange-400',
  'bg-pink-400',
  'bg-purple-400',
  'bg-yellow-400',
  'bg-red-400',
  'bg-teal-400',
  'bg-indigo-400',
  'bg-cyan-400',
];

export const TimelinePage: React.FC = () => {
  const { projects, loading } = useSupabaseData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [ganttViewStartDate, setGanttViewStartDate] = useState(new Date(2026, 0, 1)); // 2026/1/1 をデフォルト

  const today = startOfDay(new Date());

  // スライダーの範囲
  const sliderMin = new Date(2026, 0, 1);
  const sliderMax = new Date(2030, 11, 31);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (deadlineFilter !== 'all') {
        if (!p.deadline) return deadlineFilter !== 'overdue';
        const d = parseISO(p.deadline);
        if (deadlineFilter === '7days') return !isBefore(d, today) && isBefore(d, addDays(today, 7));
        if (deadlineFilter === '30days') return !isBefore(d, today) && isBefore(d, addDays(today, 30));
        if (deadlineFilter === 'overdue') return isBefore(d, today);
      }
      return true;
    });
  }, [projects, statusFilter, deadlineFilter, today]);

  const sortedTimeline = [...filteredProjects].sort((a, b) => {
    const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return dateA - dateB;
  });

  const hasActiveFilter = statusFilter !== 'all' || deadlineFilter !== 'all';

  const resetFilters = () => {
    setStatusFilter('all');
    setDeadlineFilter('all');
    setFilterOpen(false);
  };

  // Gantt Chart Logic - スライダーベース
  const ganttStartDate = startOfDay(ganttViewStartDate);
  const ganttEndDate = addMonths(ganttStartDate, 2);

  const daysInGantt = useMemo(() => {
    return eachDayOfInterval({ start: ganttStartDate, end: ganttEndDate });
  }, [ganttStartDate, ganttEndDate]);

  const totalDays = daysInGantt.length;

  // スライダー値を日付に変換・更新
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const days = parseInt(e.target.value, 10);
    const newDate = new Date(sliderMin);
    newDate.setDate(newDate.getDate() + days);
    setGanttViewStartDate(startOfDay(newDate));
  };

  const sliderCurrentDays = Math.floor((ganttViewStartDate.getTime() - sliderMin.getTime()) / (1000 * 60 * 60 * 24));
  const sliderMaxDays = Math.floor((sliderMax.getTime() - sliderMin.getTime()) / (1000 * 60 * 60 * 24));

  const getProjectColor = (projectId: string, index: number) => {
    return colorPalette[index % colorPalette.length];
  };

  const getPositionStyles = (startDateStr: string | null, endDateStr: string | null) => {
    if (!startDateStr || !endDateStr) return { display: 'none' };

    const start = parseISO(startDateStr);
    const end = parseISO(endDateStr);

    // Clamp dates to gantt view
    const clampedStart = isBefore(start, ganttStartDate) ? ganttStartDate : start;
    const clampedEnd = isAfter(end, ganttEndDate) ? ganttEndDate : end;

    if (isAfter(clampedStart, ganttEndDate) || isBefore(clampedEnd, ganttStartDate)) {
      return { display: 'none' };
    }

    const leftPercent = (differenceInDays(clampedStart, ganttStartDate) / totalDays) * 100;
    const widthPercent = (differenceInDays(clampedEnd, clampedStart) / totalDays) * 100;

    return {
      left: `${Math.max(0, leftPercent)}%`,
      width: `${Math.max(0.5, widthPercent)}%`,
    };
  };

  const handleExportCSV = () => {
    const headers = ['現場名', '着工日', '完工予定日', '期限', 'ステータス', '受注金額'];
    const rows = sortedTimeline.map(item => [
      item.name,
      item.start_date || '',
      item.planned_end_date || '',
      item.deadline || '',
      item.status,
      item.total_order_amount
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `construx_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-blue-100 text-blue-800 border-blue-200">進行中</Badge>;
      case 'completed': return <Badge className="bg-gray-100 text-gray-800 border-gray-200">完了</Badge>;
      case 'invoiced': return <Badge className="bg-green-100 text-green-800 border-green-200">請求済</Badge>;
      default: return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">待機中</Badge>;
    }
  };

  const isUrgent = (dateStr: string | null) => {
    if (!dateStr) return false;
    const date = parseISO(dateStr);
    const nextWeek = addDays(today, 7);
    return isBefore(date, nextWeek) && isAfter(date, today);
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
            <h1 className="text-4xl font-bold tracking-tight text-dashboard-ink">Billing Timeline</h1>
            <p className="text-sm text-muted-foreground">請求期限・ガントチャート</p>
          </div>
          <div className="flex gap-4 items-center">
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger render={
                <Button
                  variant="outline"
                  className={`gap-2 ${hasActiveFilter ? 'border-blue-500 text-blue-600 bg-blue-50' : ''}`}
                />
              }>
                <Filter size={18} />
                フィルター
                {hasActiveFilter && <Badge className="ml-1 bg-blue-500 text-white text-[10px] px-1.5 py-0">ON</Badge>}
              </PopoverTrigger>
              <PopoverContent className="w-64 p-4 space-y-4" align="end">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ステータス</label>
                  <Select value={statusFilter} onValueChange={(v: StatusFilter) => setStatusFilter(v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="pending">待機中</SelectItem>
                      <SelectItem value="active">進行中</SelectItem>
                      <SelectItem value="completed">完了</SelectItem>
                      <SelectItem value="invoiced">請求済</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">請求期限</label>
                  <Select value={deadlineFilter} onValueChange={(v: DeadlineFilter) => setDeadlineFilter(v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="7days">7日以内</SelectItem>
                      <SelectItem value="30days">30日以内</SelectItem>
                      <SelectItem value="overdue">期限超過</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilter && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="w-full text-xs text-muted-foreground gap-1">
                    <X size={12} />フィルターをリセット
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            <Button onClick={handleExportCSV} className="bg-[var(--dashboard-accent)] text-white hover:bg-[var(--dashboard-accent)]/90 gap-2">
              <Download size={18} />
              CSVエクスポート
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8">
          {/* Date Range Slider */}
          <div className="border border-dashboard-line rounded-xl p-6 bg-white shadow-sm space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-dashboard-ink">表示期間（2ヶ月）</label>
                <span className="text-xs text-muted-foreground">
                  {format(ganttStartDate, 'yyyy年MM月dd日')} ～ {format(ganttEndDate, 'yyyy年MM月dd日')}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max={sliderMaxDays}
                value={sliderCurrentDays}
                onChange={handleSliderChange}
                className="w-full cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{format(sliderMin, 'yyyy年MM月dd日')}</span>
                <span>{format(sliderMax, 'yyyy年MM月dd日')}</span>
              </div>
            </div>
          </div>

          {/* Gantt Chart Visualization */}
          <div className="border border-dashboard-line rounded-xl p-6 bg-white shadow-sm space-y-6">
            <h3 className="font-bold flex items-center gap-2 text-dashboard-ink">
              <Calendar size={18} className="text-[var(--dashboard-accent)]" />
              プロジェクト進行状況
            </h3>

            <ScrollArea className="w-full rounded-md border border-dashboard-line/50">
              <div className="flex">
                {/* Project Names Column (Left Fixed) */}
                <div className="w-48 shrink-0 border-r border-dashboard-line/50">
                  <div className="h-12 border-b border-dashboard-line/50 flex items-center px-4 font-bold text-xs text-muted-foreground">
                    現場
                  </div>
                  <ScrollArea className="h-96">
                    <div className="space-y-4 p-4">
                      {sortedTimeline.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm">プロジェクトなし</div>
                      )}
                      {sortedTimeline.map((item, idx) => (
                        <div key={item.id} className="text-xs font-medium text-dashboard-ink truncate">
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Gantt Chart (Right Scrollable) */}
                <div className="flex-1">
                  <div className="whitespace-nowrap">
                    {/* Timeline Header (Months/Days) */}
                    <div className="flex border-b border-dashboard-line mb-0 relative h-12">
                      {daysInGantt.map((day, i) => {
                        const isFirstOfMonth = day.getDate() === 1;
                        return (
                          <div key={i} className="flex-1 relative border-l border-dashboard-line/20 h-full min-w-[20px]">
                            {isFirstOfMonth && (
                              <span className="absolute -top-2 left-2 text-xs font-bold text-dashboard-ink">
                                {format(day, 'M月')}
                              </span>
                            )}
                            {day.getDate() % 5 === 0 && (
                              <span className="absolute bottom-1 left-1 text-[10px] text-muted-foreground">
                                {day.getDate()}
                              </span>
                            )}
                          </div>
                        );
                      })}
                      {/* Today Indicator Line */}
                      {isAfter(today, ganttStartDate) && isBefore(today, ganttEndDate) && (
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-10"
                          style={{ left: `${(differenceInDays(today, ganttStartDate) / totalDays) * 100}%` }}
                        >
                          <span className="absolute -top-5 -translate-x-1/2 text-[10px] text-white font-bold bg-red-500 px-2 py-0.5 rounded-full">Today</span>
                        </div>
                      )}
                    </div>

                    {/* Gantt Rows */}
                    <div className="space-y-4 relative p-4">
                      {/* Background Grid */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {daysInGantt.map((_, i) => (
                          <div key={i} className="flex-1 border-l border-dashboard-line/10 h-full min-w-[20px]" />
                        ))}
                      </div>

                      {sortedTimeline.length === 0 && (
                        <div className="text-center text-muted-foreground text-sm py-4">プロジェクトがありません</div>
                      )}

                      {sortedTimeline.map((item, idx) => (
                        <div key={item.id} className="relative h-10 flex items-center group">
                          {/* Gantt Bar */}
                          {item.start_date && item.planned_end_date && (
                            <Tooltip>
                              <TooltipTrigger render={
                                <div
                                  className={`absolute h-8 rounded-md flex items-center px-3 text-xs font-medium text-white whitespace-nowrap overflow-hidden transition-all shadow-sm cursor-pointer ${getProjectColor(item.id, idx)}`}
                                  style={getPositionStyles(item.start_date, item.planned_end_date)}
                                />
                              }>
                                {item.name}
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-bold">{item.name}</p>
                                  <p className="text-xs">着工: {format(parseISO(item.start_date), 'yyyy/MM/dd')}</p>
                                  <p className="text-xs">完工予定: {format(parseISO(item.planned_end_date), 'yyyy/MM/dd')}</p>
                                  <p className="text-xs">ステータス: {item.status}</p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {/* Deadline Marker */}
                          {item.deadline && (
                            <div
                              className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white top-1/2 -translate-y-1/2 z-10 shadow-sm"
                              style={{ left: `${(differenceInDays(parseISO(item.deadline), ganttStartDate) / totalDays) * 100}%` }}
                              title={`請求期限: ${item.deadline}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          {/* Detailed Table */}
          <div className="border border-dashboard-line rounded-xl bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-dashboard-line">
                  <TableHead className="font-bold text-dashboard-ink">期限</TableHead>
                  <TableHead className="font-bold text-dashboard-ink">現場名</TableHead>
                  <TableHead className="font-bold text-dashboard-ink">ステータス</TableHead>
                  <TableHead className="font-bold text-dashboard-ink">受注金額</TableHead>
                  <TableHead className="font-bold text-dashboard-ink text-right">アクション</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedTimeline.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      プロジェクトがありません
                    </TableCell>
                  </TableRow>
                )}
                {sortedTimeline.map((item) => (
                  <TableRow key={item.id} className="border-dashboard-line hover:bg-slate-50 transition-colors">
                    <TableCell className={`font-medium ${isUrgent(item.deadline) ? 'text-red-600 font-bold' : ''}`}>
                      {item.deadline ? format(parseISO(item.deadline), 'yyyy年MM月dd日', { locale: ja }) : '未定'}
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="font-mono">¥{Number(item.total_order_amount).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="text-xs text-[var(--dashboard-accent)] hover:text-[var(--dashboard-accent)]/80">詳細</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
