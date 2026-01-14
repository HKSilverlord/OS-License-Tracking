
import { BaseService } from './BaseService';
import { MonthlyRecord } from '../types';

export class RecordService extends BaseService {

    async getRecords(periodLabel: string) {
        const { data, error } = await this.supabase
            .from('monthly_records')
            .select('*')
            .eq('period_label', periodLabel);

        if (error) throw error;
        return data as MonthlyRecord[];
    }

    async getAllRecords(year: number) {
        const { data, error } = await this.supabase
            .from('monthly_records')
            .select('*')
            .eq('year', year);

        if (error) throw error;
        return data as MonthlyRecord[];
    }

    async upsertRecord(record: Partial<MonthlyRecord> & { project_id: string, year: number, month: number }) {
        // Ensure period_label exists
        const period_label = record.period_label || `${record.year}-${record.month <= 6 ? 'H1' : 'H2'}`;

        const payload = {
            project_id: record.project_id,
            year: record.year,
            month: record.month,
            period_label: period_label,
            planned_hours: record.planned_hours ?? 0,
            actual_hours: record.actual_hours ?? 0
        };

        const { data, error } = await this.supabase
            .from('monthly_records')
            .upsert(payload, { onConflict: 'project_id,period_label,year,month' })
            .select()
            .single();

        if (error) throw error;
        return data as MonthlyRecord;
    }
}

export const recordService = new RecordService();
