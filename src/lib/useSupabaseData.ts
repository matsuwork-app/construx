import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Database } from '../types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type ExpenseRow = Database['public']['Tables']['project_expenses']['Row'];
type AssignmentRow = Database['public']['Tables']['project_assignments']['Row'];
type WorkReportRow = Database['public']['Tables']['work_reports']['Row'];

export interface RecentActivity extends WorkReportRow {
  userName: string;
  projectName: string;
}

export interface ProjectData extends ProjectRow {
  expenses: ExpenseRow[];
  assignments: AssignmentRow[];
  workReports: WorkReportRow[];
  laborCost: number;
}

export function useSupabaseData() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: projectsData },
        { data: profilesData },
        { data: expensesData },
        { data: assignmentsData },
        { data: workReportsData }
      ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*'),
        supabase.from('project_expenses').select('*'),
        supabase.from('project_assignments').select('*'),
        supabase.from('work_reports').select('*').order('created_at', { ascending: false })
      ]);

      if (profilesData) setProfiles(profilesData);

      // 最新10件の活動フィードを work_reports から生成
      if (workReportsData && projectsData && profilesData) {
        const activities: RecentActivity[] = workReportsData.slice(0, 10).map(report => {
          const project = projectsData.find(p => p.id === report.project_id);
          const profile = profilesData.find(p => p.id === report.user_id);
          return {
            ...report,
            userName: profile?.full_name ?? '不明なユーザー',
            projectName: project?.name ?? '不明な現場',
          };
        });
        setRecentActivities(activities);
      }

      if (projectsData) {
        const enrichedProjects: ProjectData[] = projectsData.map(p => {
          const pExpenses = expensesData?.filter(e => e.project_id === p.id) || [];
          const pAssignments = assignmentsData?.filter(a => a.project_id === p.id) || [];
          const pWorkReports = workReportsData?.filter(w => w.project_id === p.id) || [];
          
          // Calculate labor cost
          let laborCost = 0;
          pWorkReports.forEach(report => {
            if (report.man_hours) {
              const profile = profilesData?.find(prof => prof.id === report.user_id);
              if (profile) {
                // Assuming daily_rate is for 8 hours
                const hourlyRate = profile.daily_rate / 8;
                laborCost += hourlyRate * report.man_hours;
              }
            }
          });

          return {
            ...p,
            expenses: pExpenses,
            assignments: pAssignments,
            workReports: pWorkReports,
            laborCost: Math.round(laborCost)
          };
        });
        setProjects(enrichedProjects);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Subscribe to changes
    const channels = supabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_expenses' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_assignments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_reports' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channels);
    };
  }, []);

  return { projects, profiles, recentActivities, loading, refetch: fetchData };
}
