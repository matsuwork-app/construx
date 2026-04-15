export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'president' | 'admin' | 'foreman' | 'worker'
          daily_rate: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: 'president' | 'admin' | 'foreman' | 'worker'
          daily_rate?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'president' | 'admin' | 'foreman' | 'worker'
          daily_rate?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          address: string | null
          received_date: string | null
          start_date: string | null
          planned_end_date: string | null
          deadline: string | null
          total_order_amount: number
          status: 'pending' | 'active' | 'completed' | 'invoiced'
          target_profit_margin: number
          final_invoice_amount: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          received_date?: string | null
          start_date?: string | null
          planned_end_date?: string | null
          deadline?: string | null
          total_order_amount?: number
          status?: 'pending' | 'active' | 'completed' | 'invoiced'
          target_profit_margin?: number
          final_invoice_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          received_date?: string | null
          start_date?: string | null
          planned_end_date?: string | null
          deadline?: string | null
          total_order_amount?: number
          status?: 'pending' | 'active' | 'completed' | 'invoiced'
          target_profit_margin?: number
          final_invoice_amount?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      work_reports: {
        Row: {
          id: string
          project_id: string
          user_id: string
          start_time: string
          end_time: string | null
          man_hours: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          start_time: string
          end_time?: string | null
          man_hours?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          start_time?: string
          end_time?: string | null
          man_hours?: number | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      project_photos: {
        Row: {
          id: string
          project_id: string
          report_id: string | null
          storage_path: string
          caption: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          report_id?: string | null
          storage_path: string
          caption?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          report_id?: string | null
          storage_path?: string
          caption?: string | null
          created_at?: string
        }
        Relationships: []
      }
      project_expenses: {
        Row: {
          id: string
          project_id: string
          category: string
          amount: number
          expense_date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          category: string
          amount?: number
          expense_date: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          category?: string
          amount?: number
          expense_date?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          id: string
          project_id: string
          user_id: string
          assigned_at: string
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          assigned_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          assigned_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'president' | 'admin' | 'foreman' | 'worker'
      project_status: 'pending' | 'active' | 'completed' | 'invoiced'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
