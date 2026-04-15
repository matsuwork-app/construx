import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Image as ImageIcon,
  X,
  Play,
  Square,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useSupabaseData } from '@/lib/useSupabaseData';
import { Link } from 'react-router-dom';

interface PhotoEntry {
  id: string;
  url: string;
  storagePath: string;
}

export const MobileReportPage: React.FC = () => {
  const { user } = useAuth();
  const { projects, loading: projectsLoading } = useSupabaseData();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [isWorking, setIsWorking] = useState(false);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [workStartTime, setWorkStartTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // プロジェクトが1件のみなら自動選択
  useEffect(() => {
    if (!selectedProjectId && projects.length === 1) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  // 経過時間タイマー
  useEffect(() => {
    if (isWorking && workStartTime) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - workStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setElapsed(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isWorking, workStartTime]);

  const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const handleStart = async () => {
    if (!selectedProjectId) { toast.error('現場を選択してください'); return; }
    if (!user) { toast.error('ログインが必要です'); return; }

    const now = new Date();
    const { data, error } = await supabase.from('work_reports').insert({
      project_id: selectedProjectId,
      user_id: user.id,
      start_time: now.toISOString(),
    }).select().single();

    if (error) {
      toast.error('作業開始の記録に失敗しました');
      return;
    }
    setCurrentReportId(data.id);
    setIsWorking(true);
    setWorkStartTime(now);
    toast.success('作業を開始しました');
  };

  const handleEnd = async () => {
    if (!currentReportId || !workStartTime) return;

    const now = new Date();
    const manHours = (now.getTime() - workStartTime.getTime()) / (1000 * 60 * 60);

    const { error } = await supabase.from('work_reports').update({
      end_time: now.toISOString(),
      man_hours: Math.round(manHours * 10) / 10,
    }).eq('id', currentReportId);

    if (error) {
      toast.error('作業終了の記録に失敗しました');
      return;
    }
    setIsWorking(false);
    setWorkStartTime(null);
    setCurrentReportId(null);
    toast.success('作業を終了しました');
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) {
      if (!selectedProjectId) toast.error('現場を選択してください');
      return;
    }
    if (photos.length >= 100) { toast.error('写真は1現場100枚までです'); return; }

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

    const { data: photoRecord, error: dbError } = await supabase.from('project_photos').insert({
      project_id: selectedProjectId,
      report_id: currentReportId,
      storage_path: storagePath,
    }).select().single();

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

  return (
    <div className="mobile-container space-y-6 max-w-md mx-auto pb-20">
      <header className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold tracking-tight">現場報告</h2>
          <p className="text-xs text-muted-foreground font-bold">作業開始・終了・写真アップロード</p>
        </div>
      </header>

      {/* 現場選択 */}
      <Card className="rounded-2xl border-dashboard-line shadow-sm">
        <CardContent className="p-4">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground block mb-2">現場を選択</label>
          {projectsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />読み込み中...</div>
          ) : (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={isWorking}>
              <SelectTrigger className="rounded-xl border-dashboard-line">
                <SelectValue placeholder="現場を選択してください..." />
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

      {/* Status Card */}
      <div className="mobile-card space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">現在のステータス</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isWorking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="font-bold">{isWorking ? '作業中' : '未開始'}</span>
            </div>
          </div>
          {isWorking && (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">経過時間</p>
              <p className="font-mono font-bold">{formatElapsed(elapsed)}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isWorking ? (
            <Button
              onClick={handleStart}
              disabled={!selectedProjectId}
              className="h-32 rounded-[2rem] bg-dashboard-ink text-dashboard-bg hover:bg-dashboard-ink/90 flex flex-col gap-3 shadow-lg disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Play fill="currentColor" size={20} />
              </div>
              <span className="font-bold text-lg">開始報告</span>
            </Button>
          ) : (
            <Button
              onClick={handleEnd}
              variant="outline"
              className="h-32 rounded-[2rem] border-4 border-dashboard-ink flex flex-col gap-3 shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-dashboard-ink flex items-center justify-center text-dashboard-bg">
                <Square fill="currentColor" size={20} />
              </div>
              <span className="font-bold text-lg">終了報告</span>
            </Button>
          )}

          <Button
            onClick={handlePhotoClick}
            disabled={uploadingPhoto || !selectedProjectId}
            className="h-32 rounded-[2rem] bg-blue-600 text-white hover:bg-blue-700 flex flex-col gap-3 shadow-lg disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              {uploadingPhoto ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
            </div>
            <span className="font-bold text-lg">写真撮影</span>
          </Button>
        </div>
      </div>

      {/* 写真ギャラリー */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ImageIcon size={16} />
            現場写真
            <span className="text-xs font-normal opacity-60">({photos.length}/100)</span>
          </h3>
        </div>

        {photos.length === 0 ? (
          <div className="mobile-card h-40 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-transparent text-muted-foreground gap-2">
            <Camera size={32} strokeWidth={1} />
            <p className="text-xs font-medium">写真はまだありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-3xl overflow-hidden shadow-sm group">
                <img
                  src={photo.url}
                  alt="現場写真"
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => handleRemovePhoto(photo)}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md"
                >
                  <X size={16} />
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

      {/* ボトムナビ */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-4 flex justify-around items-center z-50">
        <Button variant="ghost" size="icon" className="text-dashboard-ink">
          <Clock />
        </Button>
        <button
          onClick={handlePhotoClick}
          disabled={uploadingPhoto || !selectedProjectId}
          className="w-12 h-12 rounded-full bg-dashboard-ink flex items-center justify-center text-dashboard-bg -mt-10 shadow-xl border-4 border-white disabled:opacity-50"
        >
          <Camera />
        </button>
        <Button variant="ghost" size="icon" className="text-gray-400">
          <CheckCircle2 />
        </Button>
      </div>
    </div>
  );
};
