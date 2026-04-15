import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Database } from '../types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];
type StaffMemberRow = Database['public']['Tables']['staff_members']['Row'];
type ExpenseRow = Database['public']['Tables']['project_expenses']['Row'];
type AssignmentRow = Database['public']['Tables']['project_assignments']['Row'];

export interface ProjectData extends ProjectRow {
  expenses: ExpenseRow[];
  assignments: AssignmentRow[];
}

export function useSupabaseData() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [profiles, setProfiles] = useState<StaffMemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: projectsData },
        { data: staffData },
        { data: expensesData },
        { data: assignmentsData },
      ] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('staff_members').select('*'),
        supabase.from('project_expenses').select('*'),
        supabase.from('project_assignments').select('*'),
      ]);

      if (staffData) setProfiles(staffData);

      if (projectsData) {
        const enrichedProjects: ProjectData[] = projectsData.map(p => {
          const pExpenses = expensesData?.filter(e => e.project_id === p.id) || [];
          const pAssignments = assignmentsData?.filter(a => a.project_id === p.id) || [];
          return {
            ...p,
            expenses: pExpenses,
            assignments: pAssignments,
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

    const channels = supabase.channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_expenses' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_assignments' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channels);
    };
  }, []);

  return { projects, profiles, loading, refetch: fetchData };
}
