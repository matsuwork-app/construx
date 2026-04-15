-- ==========================================
-- Construx - 建設現場工程・請求管理システム
-- Supabase Database Schema
-- ==========================================

-- 1. Enums
CREATE TYPE user_role AS ENUM ('president', 'admin', 'foreman', 'worker');
CREATE TYPE project_status AS ENUM ('pending', 'active', 'completed', 'invoiced');

-- 2. Profiles (Users)
-- auth.usersテーブルと連携
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'worker' NOT NULL,
  daily_rate NUMERIC DEFAULT 0 NOT NULL, -- 親方・作業員の日当
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Projects (現場)
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT, -- 現場住所
  received_date DATE, -- 案件受付日
  start_date DATE, -- 着工日
  planned_end_date DATE, -- 完工予定日
  deadline DATE,
  total_order_amount NUMERIC DEFAULT 0 NOT NULL, -- 受注総額
  status project_status DEFAULT 'pending' NOT NULL,
  target_profit_margin NUMERIC DEFAULT 0.2 NOT NULL, -- 目標粗利率 (0.2 = 20%)
  final_invoice_amount NUMERIC, -- 最終決定請求金額
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Work Reports (工数報告)
CREATE TABLE work_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  man_hours NUMERIC, -- 自動計算または手動入力
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. Project Photos (現場写真)
CREATE TABLE project_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  report_id UUID REFERENCES work_reports(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL, -- Supabase Storageのパス
  caption TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Project Expenses (経費)
CREATE TABLE project_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL, -- '部材費', 'ガソリン代' など
  amount NUMERIC DEFAULT 0 NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Project Assignments (現場アサイン)
CREATE TABLE project_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(project_id, user_id)
);

-- 8. RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;

-- 9. Policies (Basic)
-- Profiles: 全員参照可、本人更新可、管理者は全操作可
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- Projects: 認証済みユーザーは参照可能、管理者は全て管理可能
CREATE POLICY "Projects are viewable by authenticated users" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage projects" ON projects FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- Work Reports: 自分の報告は全操作可、管理者は全て参照可能
CREATE POLICY "Users can manage own reports" ON work_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all reports" ON work_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- Project Photos: 認証済みユーザーは参照・投稿可、削除は本人か管理者のみ
CREATE POLICY "Photos are viewable by authenticated users" ON project_photos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can upload photos" ON project_photos FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Admins can delete photos" ON project_photos FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- Project Expenses: 認証済みユーザーは参照可能、管理者は全て管理可能
CREATE POLICY "Expenses are viewable by authenticated users" ON project_expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage expenses" ON project_expenses FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- Project Assignments: 認証済みユーザーは参照可能、管理者は全て管理可能
CREATE POLICY "Assignments are viewable by authenticated users" ON project_assignments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage assignments" ON project_assignments FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('president', 'admin'))
);

-- 10. Storage Bucket Setup (Supabase UI で手動作成)
-- Bucket name: 'project-photos'
-- 設定: Public bucket OFF (RLS管理) または Public ON (簡易公開)
-- Storage Policy (SQL Editor で実行):
--   CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-photos');
--   CREATE POLICY "Authenticated users can read"   ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'project-photos');
--   CREATE POLICY "Users can delete own files"     ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'project-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 11. Functions & Triggers

-- 11-1. updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 11-2. Auth ユーザー新規登録時に profiles レコードを自動作成するトリガー
--       Supabase Auth → Database の連携。ユーザー登録後に profiles が存在しない場合に作成。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, daily_rate)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'worker',
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
