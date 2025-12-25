-- Create a history table to store previous versions of records
create table public.record_history (
  id uuid primary key default gen_random_uuid(),
  record_id uuid references public.records(id) on delete cascade,
  project_id uuid,
  period_label text,
  year integer,
  month integer,
  planned_hours numeric,
  actual_hours numeric,
  changed_at timestamp with time zone default now(),
  changed_by uuid -- Optional: if you want to track who made the change
);

-- Enable RLS for history
alter table public.record_history enable row level security;
create policy "Enable read access for authenticated users"
  on public.record_history for select to authenticated using (true);

-- Create a function to handle the history logging
create or replace function handle_record_history()
returns trigger as $$
begin
  if (TG_OP = 'UPDATE') then
    insert into public.record_history (
      record_id, project_id, period_label, year, month, planned_hours, actual_hours
    )
    values (
      OLD.id, OLD.project_id, OLD.period_label, OLD.year, OLD.month, OLD.planned_hours, OLD.actual_hours
    );
  end if;
  return NEW;
end;
$$ language plpgsql;

-- Create the trigger
create trigger on_record_update
  after update on public.records
  for each row
  execute function handle_record_history();
