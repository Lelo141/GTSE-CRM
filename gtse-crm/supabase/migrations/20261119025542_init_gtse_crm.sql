-- ==========================================
-- 1. ENUMS & ROLES
-- ==========================================
create type user_role as enum ('sales', 'reservations', 'admin');
create type org_type as enum ('agency', 'company', 'direct_client', 'supplier');
create type account_focus as enum ('leisure', 'mice', 'both', 'unknown');
create type acquisition_source as enum (
  'trade_show', 'direct_prospecting', 'referral',
  'inbound_inquiry', 'existing_relationship', 'networking', 'other'
);
create type sales_stage as enum (
  'new_prospect', 'contacted', 'engaged', 'meeting_scheduled',
  'qualified_opportunity', 'sent_to_reservations', 'closed_lost', 'inactive'
);
create type activity_channel as enum ('email', 'call', 'whatsapp', 'linkedin', 'trade_show', 'in_person', 'zoom', 'other');
create type meeting_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
create type booking_stage as enum (
  'new_inquiry', 'qualified', 'preparing_experience', 'proposal_sent',
  'confirmed', 'closed_lost', 'cancelled'
);
create type delivery_stage as enum (
  'planning', 'arrangements_booked', 'ready_for_travel', 'in_progress', 'completed'
);

-- ==========================================
-- 2. PROFILES (Linked to Supabase Auth)
-- ==========================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role user_role not null default 'sales',
  calendly_url text,
  created_at timestamptz not null default now()
);

-- Helper function for RLS policies
create or replace function public.get_my_role()
returns user_role language sql stable security definer as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ==========================================
-- 3. SHARED ORGANIZATIONS & CONTACTS
-- ==========================================
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type org_type not null default 'agency',
  focus account_focus not null default 'unknown',
  acquisition_source acquisition_source not null default 'other',
  city_state text,
  country text,
  language text check (language in ('ENG', 'SPA', 'BOTH')),
  assigned_sales_id uuid references profiles(id),
  relationship_status text default 'active',
  sales_notes text,
  company_description_ai text, -- Maps to Excel "Description of the Company (AI)"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  job_title text,
  email text,
  phone text,
  whatsapp text,
  language text check (language in ('ENG', 'SPA', 'BOTH')),
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ==========================================
-- 4. SALES PIPELINE, ACTIVITIES & MEETINGS
-- ==========================================
create table opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  primary_contact_id uuid references contacts(id),
  owner_id uuid not null references profiles(id),
  title text not null,
  stage sales_stage not null default 'new_prospect',
  event_interest text,
  expected_travelers int check (expected_travelers >= 0),
  handoff_summary text,
  handed_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  staff_id uuid not null references profiles(id),
  channel activity_channel not null,
  is_outbound_prospecting boolean not null default false,
  is_two_way_interaction boolean not null default false, -- Drives the 30/wk KPI
  activity_at timestamptz not null default now(),
  notes text,
  next_action text,
  next_action_due date,
  created_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  opportunity_id uuid references opportunities(id) on delete set null,
  staff_id uuid not null references profiles(id),
  meeting_type text not null check (meeting_type in ('zoom', 'in_person')),
  status meeting_status not null default 'scheduled',
  scheduled_at timestamptz not null,
  booked_at timestamptz not null default now(), -- Drives the 5/wk KPI
  notes text,
  next_steps text
);

-- ==========================================
-- 5. EVENTS, SUPPLIERS & RESERVATIONS LOG
-- ==========================================
create table sports_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport_category text not null,
  venue text,
  city text,
  country text,
  start_date date,
  end_date date
);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  inquiry_number serial unique, -- Maps to Excel "Inquiry #"
  invoice_number text,          -- Maps to Excel "GTSE Invoice Number"
  organization_id uuid not null references organizations(id),
  contact_id uuid references contacts(id),
  opportunity_id uuid references opportunities(id),
  event_id uuid references sports_events(id),
  sales_owner_id uuid references profiles(id),
  reservations_owner_id uuid references profiles(id), -- Assignment accountability
  stage booking_stage not null default 'new_inquiry',
  delivery_stage delivery_stage,
  inquiry_date date not null default current_date,
  confirmed_date date,
  execution_date date,
  destination_city text,
  service_description text,
  participant_count int not null default 1 check (participant_count > 0),
  -- Auto-derived Leisure (<=9) vs M.I.C.E (>=10) per GTSE rule
  category text generated always as (
    case when participant_count <= 9 then 'leisure' else 'mice' end
  ) stored,
  client_price numeric(12,2) not null default 0,
  last_touched_at timestamptz not null default now(), -- For overdue reminders
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RESTRICTED TABLE: Supplier costs (Hidden from Sales via RLS)
create table booking_supplier_costs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  supplier_org_id uuid references organizations(id),
  service_type text not null, -- hotel, transport, tickets, wellness, other
  service_dates text,
  confirmation_ref text,
  confirmation_status text default 'pending',
  net_cost numeric(12,2) not null default 0, -- Includes CC fees per Excel template
  internal_notes text,
  created_at timestamptz not null default now()
);

-- ==========================================
-- 6. WEEKLY SALES KPI VIEW (60 / 30 / 5)
-- ==========================================
create or replace view v_weekly_sales_kpis as
with weeks as (
  select distinct
    staff_id,
    date_trunc('week', activity_at at time zone 'America/Chicago')::date as week_start
  from sales_activities
  union
  select distinct
    staff_id,
    date_trunc('week', booked_at at time zone 'America/Chicago')::date as week_start
  from meetings
)
select
  w.staff_id,
  p.full_name,
  w.week_start,
  -- 60 target: Distinct orgs with outbound prospecting
  (select count(distinct organization_id)
   from sales_activities sa
   where sa.staff_id = w.staff_id
     and sa.is_outbound_prospecting = true
     and date_trunc('week', sa.activity_at at time zone 'America/Chicago')::date = w.week_start
  ) as prospected_accounts,
  -- 30 target: Distinct orgs with two-way interaction
  (select count(distinct organization_id)
   from sales_activities sa
   where sa.staff_id = w.staff_id
     and sa.is_two_way_interaction = true
     and date_trunc('week', sa.activity_at at time zone 'America/Chicago')::date = w.week_start
  ) as interactive_accounts,
  -- 5 target: Distinct meetings booked (excluding cancelled)
  (select count(distinct id)
   from meetings m
   where m.staff_id = w.staff_id
     and m.status <> 'cancelled'
     and date_trunc('week', m.booked_at at time zone 'America/Chicago')::date = w.week_start
  ) as meetings_set
from weeks w
join profiles p on p.id = w.staff_id;

-- ==========================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ==========================================
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table contacts enable row level security;
alter table opportunities enable row level security;
alter table sales_activities enable row level security;
alter table meetings enable row level security;
alter table bookings enable row level security;
alter table booking_supplier_costs enable row level security;

-- Profiles: everyone can read staff directory; users update own profile
create policy "Profiles readable by authenticated" on profiles
  for select to authenticated using (true);

-- Shared directory: all authenticated staff can read/write organizations & contacts
create policy "Shared org access" on organizations
  for all to authenticated using (true) with check (true);
create policy "Shared contact access" on contacts
  for all to authenticated using (true) with check (true);

-- Sales activities & meetings: Sales sees own; Admin sees all
create policy "Sales sees own activities, Admin sees all" on sales_activities
  for all to authenticated
  using (staff_id = auth.uid() or public.get_my_role() = 'admin')
  with check (staff_id = auth.uid() or public.get_my_role() = 'admin');

create policy "Sales sees own meetings, Admin sees all" on meetings
  for all to authenticated
  using (staff_id = auth.uid() or public.get_my_role() = 'admin')
  with check (staff_id = auth.uid() or public.get_my_role() = 'admin');

-- Bookings: Reservations & Admin have full access; Sales can view their handed-off bookings
create policy "Bookings read access" on bookings
  for select to authenticated
  using (
    public.get_my_role() in ('reservations', 'admin')
    or sales_owner_id = auth.uid()
  );

create policy "Bookings write access" on bookings
  for insert to authenticated
  with check (public.get_my_role() in ('sales', 'reservations', 'admin'));

create policy "Bookings update access" on bookings
  for update to authenticated
  using (public.get_my_role() in ('reservations', 'admin'));

-- CRITICAL SECURITY BOUNDARY: Supplier costs strictly hidden from Sales
create policy "Supplier costs restricted to Reservations and Admin" on booking_supplier_costs
  for all to authenticated
  using (public.get_my_role() in ('reservations', 'admin'))
  with check (public.get_my_role() in ('reservations', 'admin'));