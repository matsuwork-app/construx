import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  ArrowLeft,
  Image as ImageIcon,
  X,
  Loader2,
  Send,
  Check,
  Users,
  CalendarDays,
  Clock,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PhotoEntry {
  id: string;
  url: string;
  storagePath: string;
}

export const MobileReportPage: React.FC = () => {
  const { user } = useAuth();
  const { projects, profiles, loading: dataLoading } = useSupabaseData();

  // ── フォーム状態 ──────────────────────────────────────────────
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── 写真 ──────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // プロジェクトが1件のみなら自動選択
  useEffect(() => {
    if (!selectedProjectId && projects.length === 1) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // ログインユーザーを作業員リストにデフォルト選択
  useEffect(() => {
    if (user && selectedStaffIds.length === 0) {
      setSelectedStaffIds([user.id]);
    }
  }, [user]);

  // 現場が変わったら写真をDBからロード
  useEffect(() => {
    if (!selectedProjectId) { setPhotos([]); return; }
    setLoadingPhotos(true);
    supabase
      .from('project_photos')
      .select('*')
      .eq('project_id', selectedProjectId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) {
          setPhotos(data.map(p => {
            const { data: urlData } = supabase.storage
              .from('project-photos')
              .getPublicUrl(p.storage_path);
            return { id: p.id, url: urlData.publicUrl, storagePath: p.storage_path };
          }));
        }
        setLoadingPhotos(false);
      });
  }, [selectedProjectId]);

  // 現場にアサインされたメンバーだけ表示（未選択時は全員）
  const assignableStaff = selectedProjectId
    ? (() => {
        const project = projects.find(p => p.id === selectedProjectId);
        if (!project || project.assignments.length === 0) return profiles;
        return profiles.filter(pr => project.assignments.some(a => a.user_id === pr.id));
      })()
    : profiles;

  const toggleStaff = (id: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // 工数計算（時間）
  const calcManHours = (): number => {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const hours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    return Math.round(Math.max(0, hours) * 10) / 10;
  };

  // 日報送信
  const handleSubmit = async () => {
    if (!selectedProjectId) { toast.error('現場を選択してください'); return; }
    if (selectedStaffIds.length === 0) { toast.error('作業員を1名以上選択してください'); return; }
    const manHours = calcManHours();
    if (manHours <= 0) { toast.error('終了時刻は開始時刻より後にしてください'); return; }

    setSubmitting(true);

    const startISO = new Date(`${reportDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${reportDate}T${endTime}:00`).toISOString();

    const reportsToInsert = selectedStaffIds.map(userId => ({
      project_id: selectedProjectId,
      user_id: userId,
      start_time: startISO,
      end_time: endISO,
      man_hours: manHours,
      notes: memo.trim() || null,
    }));

    const { error } = await supabase.from('work_reports').insert(reportsToInsert);

    setSubmitting(false);
    if (error) {
      toast.error('日報の送信に失敗しました');
      return;
    }
    toast.success(`${selectedStaffIds.length}名分の日報を送信しました（${manHours}h）`);
    setMemo('');
  };

  // 写真撮影 / アップロード
  const handlePhotoClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) {
      if (!selectedProjectId) toast.error('現場を選択してください');
      return;
    }

    setUploadingPhoto(true);
    const ext = file.name.split('.').pop();
    const storagePath = `${selectedProjectId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('project-photos')
      .upload(storagePath, file, { upsert: false });

    if (uploadError) {
      toast.error('写真のアップロードに失敗しました');
      setUploadingPhoto(false);
      e.target.value = '';
      return;
    }

    const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(storagePath);

    const { data: photoRecord, error: dbError } = await supabase
      .from('project_photos')
      .insert({ project_id: selectedProjectId, storage_path: storagePath })
      .select()
      .single();

    if (dbError) {
      toast.error('写真情報の保存に失敗しました');
    } else {
      setPhotos(prev => [{ id: photoRecord.id, url: urlData.publicUrl, storagePath }, ...prev]);
      toast.success('写真を保存しました');
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  const handleRemovePhoto = async (photo: PhotoEntry) => {
    await supabase.storage.from('project-photos').remove([photo.storagePath]);
    await supabase.from('project_photos').delete().eq('id', photo.id);
    setPhotos(prev => prev.filter(p => p.id !== photo.id));
    toast.info('写真を削除しました');
  };

  const manHours = calcManHours();

  return (
    <div className="max-w-md mx-auto pb-24 px-4 space-y-5">
      {/* ヘッダー */}
      <header className="flex items-center gap-3 pt-4">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight">日報入力</h2>
          <p className="text-xs text-muted-foreground">現場・作業員・時間を記録</p>
        </div>
      </header>

      {/* 現場選択 */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4 space-y-1">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            現場
          </Label>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 size={14} className="animate-spin" />読み込み中...
            </div>
          ) : (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="rounded-xl border-dashboard-line mt-1">
                <SelectValue placeholder="現場を選択..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* 日付 */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4 space-y-1">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <CalendarDays size={13} />作業日
          </Label>
          <Input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="rounded-xl border-dashboard-line mt-1"
          />
        </CardContent>
      </Card>

      {/* 作業時間 */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Clock size={13} />作業時間
          </Label>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">開始</Label>
              <Input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="rounded-xl border-dashboard-line text-center font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">終了</Label>
              <Input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="rounded-xl border-dashboard-line text-center font-mono"
              />
            </div>
          </div>
          {manHours > 0 && (
            <p className="text-center text-sm font-bold text-[var(--dashboard-accent)]">
              工数: {manHours}h
            </p>
          )}
        </CardContent>
      </Card>

      {/* 作業員選択 */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Users size={13} />作業員
            {selectedStaffIds.length > 0 && (
              <span className="ml-1 bg-[var(--dashboard-accent)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {selectedStaffIds.length}名
              </span>
            )}
          </Label>
          {dataLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" />読み込み中...
            </div>
          ) : assignableStaff.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">現場にアサインされたメンバーがいません</p>
          ) : (
            <div className="space-y-1">
              {assignableStaff.map(staff => {
                const selected = selectedStaffIds.includes(staff.id);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => toggleStaff(staff.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left',
                      selected
                        ? 'border-[var(--dashboard-accent)] bg-blue-50'
                        : 'border-dashboard-line bg-white hover:bg-slate-50'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors',
                      selected
                        ? 'bg-[var(--dashboard-accent)] border-[var(--dashboard-accent)]'
                        : 'border-gray-300'
                    )}>
                      {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="font-medium text-sm">{staff.full_name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      日当 ¥{Number(staff.daily_rate).toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* メモ */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <FileText size={13} />作業メモ（任意）
          </Label>
          <textarea
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="作業内容・特記事項など..."
            rows={3}
            className="w-full rounded-xl border border-dashboard-line bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--dashboard-accent)]/30"
          />
        </CardContent>
      </Card>

      {/* 送信ボタン */}
      <Button
        onClick={handleSubmit}
        disabled={submitting || !selectedProjectId || selectedStaffIds.length === 0}
        className="w-full h-14 rounded-2xl bg-dashboard-ink text-dashboard-bg hover:bg-dashboard-ink/90 text-base font-bold gap-2 shadow-lg disabled:opacity-50"
      >
        {submitting
          ? <Loader2 size={20} className="animate-spin" />
          : <Send size={20} />}
        {submitting ? '送信中...' : `日報を送信する${selectedStaffIds.length > 1 ? `（${selectedStaffIds.length}名分）` : ''}`}
      </Button>

      {/* 写真セクション */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ImageIcon size={15} />
            現場写真
            {!loadingPhotos && (
              <span className="text-xs font-normal text-muted-foreground">({photos.length}枚)</span>
            )}
          </h3>
          <Button
            size="sm"
            onClick={handlePhotoClick}
            disabled={uploadingPhoto || !selectedProjectId}
            className="h-8 rounded-xl bg-blue-600 text-white hover:bg-blue-700 gap-1.5 text-xs disabled:opacity-50"
          >
            {uploadingPhoto
              ? <Loader2 size={13} className="animate-spin" />
              : <Camera size={13} />}
            撮影・追加
          </Button>
        </div>

        {loadingPhotos ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />写真を読み込み中...
          </div>
        ) : photos.length === 0 ? (
          <div
            onClick={selectedProjectId ? handlePhotoClick : undefined}
            className={cn(
              'h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl text-muted-foreground gap-2',
              selectedProjectId && 'cursor-pointer hover:border-blue-300 hover:text-blue-400 transition-colors'
            )}
          >
            <Camera size={28} strokeWidth={1.2} />
            <p className="text-xs">{selectedProjectId ? 'タップして写真を追加' : '現場を選択してください'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden shadow-sm">
                <img src={photo.url} alt="現場写真" className="w-full h-full object-cover" />
                <button
                  onClick={() => handleRemovePhoto(photo)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 隠しファイル入力 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
