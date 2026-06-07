create extension if not exists "pgcrypto";

do $$ begin
  create type quote_status as enum ('Draft', 'Submitted', 'Approved', 'Rejected', 'Expired');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type service_pricing_type as enum ('fixed', 'quantity', 'monthly', 'annual', 'percentage', 'negotiable');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.services (
  id text primary key,
  category text not null,
  service_name text not null,
  description text not null default '',
  pricing_type service_pricing_type not null default 'fixed',
  unit_price numeric(14, 2) not null default 0,
  minimum_quantity integer not null default 1,
  maximum_quantity integer not null default 1,
  recommended_services text[] not null default '{}',
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_service_admin()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') in ('admin', 'service_admin')
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') in ('admin', 'service_admin');
$$;

create table if not exists public.service_dependencies (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(id) on delete cascade,
  depends_on_service_id text not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (service_id, depends_on_service_id)
);

create table if not exists public.service_recommendations (
  id uuid primary key default gen_random_uuid(),
  service_id text not null references public.services(id) on delete cascade,
  recommended_service_id text not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (service_id, recommended_service_id)
);

create table if not exists public.bundle_discounts (
  id text primary key,
  bundle_name text not null,
  service_ids text[] not null default '{}',
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  discount_value numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (discount_type = 'percentage' and discount_value >= 0 and discount_value <= 100)
    or (discount_type = 'fixed' and discount_value >= 0)
  )
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  client_name text,
  company_name text,
  email text,
  phone text,
  industry text,
  employee_count integer,
  subtotal numeric(14, 2) not null default 0,
  vat numeric(14, 2) not null default 0,
  discount numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  status quote_status not null default 'Draft',
  created_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  service_id text references public.services(id) on delete set null,
  service_name text not null default '',
  category text not null default '',
  description text not null default '',
  pricing_type service_pricing_type not null default 'fixed',
  quantity numeric(14, 2) not null default 1,
  annual_salary numeric(14, 2),
  unit_price numeric(14, 2) not null default 0,
  line_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  company_name text,
  email text,
  phone text,
  industry text,
  employee_count integer,
  created_at timestamptz not null default now()
);

create index if not exists services_active_category_idx on public.services (is_active, category, display_order);
create index if not exists quotes_created_at_idx on public.quotes (created_at desc);
create index if not exists quote_items_quote_id_idx on public.quote_items (quote_id);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.quote_items
  add column if not exists service_name text not null default '',
  add column if not exists category text not null default '',
  add column if not exists description text not null default '',
  add column if not exists pricing_type service_pricing_type not null default 'fixed',
  add column if not exists annual_salary numeric(14, 2);

alter table public.services enable row level security;
alter table public.service_dependencies enable row level security;
alter table public.service_recommendations enable row level security;
alter table public.bundle_discounts enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.leads enable row level security;

drop policy if exists "Public can read active services" on public.services;
create policy "Public can read active services"
  on public.services for select
  using (is_active = true);

drop policy if exists "Authenticated admins manage services" on public.services;
create policy "Authenticated admins manage services"
  on public.services for all
  using (public.is_service_admin())
  with check (public.is_service_admin());

drop policy if exists "Public can read dependencies" on public.service_dependencies;
create policy "Public can read dependencies"
  on public.service_dependencies for select
  using (
    exists (select 1 from public.services service where service.id = service_id and service.is_active = true)
    and exists (select 1 from public.services dependency where dependency.id = depends_on_service_id and dependency.is_active = true)
  );

drop policy if exists "Authenticated admins manage dependencies" on public.service_dependencies;
create policy "Authenticated admins manage dependencies"
  on public.service_dependencies for all
  using (public.is_service_admin())
  with check (public.is_service_admin());

drop policy if exists "Public can read recommendations" on public.service_recommendations;
create policy "Public can read recommendations"
  on public.service_recommendations for select
  using (
    exists (select 1 from public.services service where service.id = service_id and service.is_active = true)
    and exists (select 1 from public.services recommendation where recommendation.id = recommended_service_id and recommendation.is_active = true)
  );

drop policy if exists "Authenticated admins manage recommendations" on public.service_recommendations;
create policy "Authenticated admins manage recommendations"
  on public.service_recommendations for all
  using (public.is_service_admin())
  with check (public.is_service_admin());

drop policy if exists "Public can read bundle discounts" on public.bundle_discounts;
create policy "Public can read bundle discounts"
  on public.bundle_discounts for select
  using (is_active = true);

drop policy if exists "Authenticated admins manage bundle discounts" on public.bundle_discounts;
create policy "Authenticated admins manage bundle discounts"
  on public.bundle_discounts for all
  using (public.is_service_admin())
  with check (public.is_service_admin());

drop policy if exists "Public can create quotes" on public.quotes;

drop policy if exists "Authenticated admins read quotes" on public.quotes;
create policy "Authenticated admins read quotes"
  on public.quotes for select
  using (public.is_service_admin());

drop policy if exists "Authenticated admins update quotes" on public.quotes;
create policy "Authenticated admins update quotes"
  on public.quotes for update
  using (public.is_service_admin())
  with check (public.is_service_admin());

drop policy if exists "Public can create quote items" on public.quote_items;

drop policy if exists "Authenticated admins read quote items" on public.quote_items;
create policy "Authenticated admins read quote items"
  on public.quote_items for select
  using (public.is_service_admin());

drop policy if exists "Public can create leads" on public.leads;

drop policy if exists "Authenticated admins read leads" on public.leads;
create policy "Authenticated admins read leads"
  on public.leads for select
  using (public.is_service_admin());

insert into public.services (id, category, service_name, description, pricing_type, unit_price, minimum_quantity, maximum_quantity, recommended_services, display_order, is_active) values
('name-search', 'Business Setup & Compliance', 'Name Search', 'Availability search and reservation support for business registration.', 'fixed', 350, 1, 1, array['tpin-registration'], 1, true),
('company-registration', 'Business Setup & Compliance', 'Company Registration', 'PACRA, NGO, or cooperative registration support from document preparation to submission.', 'fixed', 7000, 1, 1, array['name-search','tpin-registration','napsa-registration','nhima-registration','workers-comp-registration'], 2, true),
('tpin-registration', 'Business Setup & Compliance', 'TPIN Registration', 'ZRA TPIN setup support for a newly registered or existing business.', 'fixed', 900, 1, 1, array['napsa-registration'], 3, true),
('napsa-registration', 'Business Setup & Compliance', 'NAPSA Registration', 'Employer registration support for social security compliance.', 'fixed', 1200, 1, 1, array['nhima-registration','workers-comp-registration'], 4, true),
('nhima-registration', 'Business Setup & Compliance', 'NHIMA Registration', 'Employer registration support for national health insurance compliance.', 'fixed', 1200, 1, 1, array['payroll-setup'], 5, true),
('workers-comp-registration', 'Business Setup & Compliance', 'Workers Compensation Registration', 'Workers compensation registration guidance and filing support.', 'fixed', 1200, 1, 1, array['payroll-setup'], 6, true),
('company-profile-basic', 'Strategic Business Support', 'Company Profile Design', 'Professional company profile design for tenders, banks, and client presentations.', 'quantity', 1500, 1, 2, array['business-plan'], 7, true),
('business-plan', 'Strategic Business Support', 'Business Plan Development', 'Investor-ready business plan with practical market, operations, and financial sections.', 'quantity', 3000, 1, 3, array['financial-operational-review'], 8, true),
('financial-operational-review', 'Strategic Business Support', 'Financial and Operational Review', 'Structured review of operating performance, controls, and improvement priorities.', 'fixed', 6500, 1, 1, array['strategy-session'], 9, true),
('strategy-session', 'Strategic Business Support', 'Strategy Session', 'Focused advisory session for founders, managers, or leadership teams.', 'quantity', 950, 1, 12, array['hr-metrics-reports'], 10, true),
('payroll-setup', 'HR & Payroll Solutions', 'Payroll Setup', 'Initial payroll configuration with statutory compliance checks and payroll calendar setup.', 'fixed', 5500, 1, 1, array['napsa-registration','nhima-registration','employment-contracts'], 11, true),
('payroll-services', 'HR & Payroll Solutions', 'Payroll Services', 'Monthly payroll processing support, statutory schedules, and payroll reports.', 'monthly', 10200, 1, 24, array['employment-contracts','employee-handbook','hris-implementation','salary-benchmarking'], 12, true),
('hris-implementation', 'HR & Payroll Solutions', 'HRIS Implementation', 'Implementation support for employee records, leave, documents, workflows, and reporting.', 'fixed', 15000, 1, 1, array['payroll-services','hr-metrics-reports'], 13, true),
('bmas-staff-portal', 'HR & Payroll Solutions', 'BMAS Staff Portal', 'Annual access and implementation support for a central HR and staff self-service portal.', 'annual', 15000, 1, 3, array['hris-implementation'], 14, true),
('employment-contracts', 'Human Resources Solutions', 'Employment Contracts', 'Employment contract templates and role-specific contract preparation.', 'quantity', 2500, 1, 100, array['onboarding-support','employee-handbook'], 15, true),
('employee-handbook', 'Human Resources Solutions', 'Employee Handbook', 'Policy handbook aligned to practical HR operations and employer obligations.', 'fixed', 4000, 1, 1, array['hr-audit-policy'], 16, true),
('hr-audit-policy', 'Human Resources Solutions', 'HR Audit & Policy Development', 'HR compliance audit, gap report, and priority policy development.', 'fixed', 10000, 1, 1, array['compliance-review'], 17, true),
('compliance-review', 'Human Resources Solutions', 'Full Compliance Review', 'End-to-end review of HR, statutory, payroll, and employer compliance readiness.', 'fixed', 8500, 1, 1, array['hr-outsourcing','hr-metrics-reports'], 18, true),
('hr-outsourcing', 'Human Resources Solutions', 'HR Outsourcing', 'Monthly HR operations support, employee relations guidance, records, and advisory touchpoints.', 'monthly', 16500, 1, 24, array['engagement-surveys','hr-metrics-reports','training-needs-analysis'], 19, true),
('salary-benchmarking', 'Human Resources Solutions', 'Salary Benchmarking', 'Pay structure review and benchmark guidance for critical roles.', 'fixed', 4500, 1, 1, array['hr-metrics-reports'], 20, true),
('hr-metrics-reports', 'Human Resources Solutions', 'HR Metrics Reports', 'People analytics reports covering headcount, turnover, absenteeism, and payroll trends.', 'monthly', 3500, 1, 12, array['engagement-surveys'], 21, true),
('recruitment-service', 'Recruitment', 'Recruitment Service', 'Recruitment support priced as a percentage of annual gross salary.', 'percentage', 0.07, 1, 1, array['employment-contracts','onboarding-support','employee-handbook'], 22, true),
('recruitment-per-role', 'Recruitment', 'Recruitment Per Role', 'Role-based recruitment administration for entry and mid-level positions.', 'quantity', 1000, 1, 20, array['employment-contracts'], 23, true),
('onboarding-support', 'Recruitment', 'Onboarding Support', 'Practical onboarding pack, first-week plan, and hiring documentation support.', 'quantity', 1200, 1, 100, array['employee-handbook'], 24, true),
('training-program', 'Training & Development', 'Training Program', 'Employee training session priced per participant.', 'quantity', 1200, 1, 500, array['training-needs-analysis'], 25, true),
('training-needs-analysis', 'Training & Development', 'Training Needs Analysis', 'Structured assessment of skills gaps and priority learning needs.', 'fixed', 5000, 1, 1, array['training-program'], 26, true),
('engagement-surveys', 'Training & Development', 'Employee Engagement Surveys', 'Survey setup, administration, analysis, and recommendations report.', 'quantity', 350, 10, 1000, array['hr-metrics-reports'], 27, true),
('team-building', 'Training & Development', 'Team Building Activities', 'Custom team-building design and facilitation for staff groups.', 'negotiable', 0, 1, 1, array['training-program'], 28, true)
on conflict (id) do update set
  category = excluded.category,
  service_name = excluded.service_name,
  description = excluded.description,
  pricing_type = excluded.pricing_type,
  unit_price = excluded.unit_price,
  minimum_quantity = excluded.minimum_quantity,
  maximum_quantity = excluded.maximum_quantity,
  recommended_services = excluded.recommended_services,
  display_order = excluded.display_order,
  is_active = excluded.is_active;

insert into public.service_dependencies (service_id, depends_on_service_id) values
('payroll-setup', 'napsa-registration'),
('payroll-setup', 'nhima-registration'),
('company-registration', 'tpin-registration'),
('recruitment-service', 'employment-contracts')
on conflict (service_id, depends_on_service_id) do nothing;

delete from public.service_recommendations
where service_id in (select id from public.services);

insert into public.service_recommendations (service_id, recommended_service_id)
select id, unnest(recommended_services)
from public.services
where cardinality(recommended_services) > 0
on conflict (service_id, recommended_service_id) do nothing;

insert into public.bundle_discounts (id, bundle_name, service_ids, discount_type, discount_value, is_active) values
('setup-starter', 'Compliance Starter Bundle', array['company-registration','napsa-registration','workers-comp-registration'], 'percentage', 7.5, true),
('payroll-ready', 'Payroll Ready Bundle', array['payroll-setup','employment-contracts','employee-handbook'], 'fixed', 1000, true),
('outsourced-hr', 'Outsourced HR Growth Bundle', array['hr-outsourcing','engagement-surveys','hr-metrics-reports'], 'percentage', 5, true)
on conflict (id) do update set
  bundle_name = excluded.bundle_name,
  service_ids = excluded.service_ids,
  discount_type = excluded.discount_type,
  discount_value = excluded.discount_value,
  is_active = excluded.is_active;

create or replace function public.sync_service_recommendations()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.service_recommendations
  where service_id = new.id;

  insert into public.service_recommendations (service_id, recommended_service_id)
  select new.id, recommendation_id
  from unnest(new.recommended_services) as recommendation_id
  where recommendation_id <> new.id
    and exists (
      select 1
      from public.services service
      where service.id = recommendation_id
    )
  on conflict (service_id, recommended_service_id) do nothing;

  return new;
end;
$$;

drop trigger if exists sync_service_recommendations_after_write on public.services;
create trigger sync_service_recommendations_after_write
after insert or update of recommended_services on public.services
for each row
execute function public.sync_service_recommendations();

create or replace function public.submit_service_quote(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  lead jsonb := coalesce(payload -> 'lead', '{}'::jsonb);
  options jsonb := coalesce(payload -> 'options', '{}'::jsonb);
  item jsonb;
  service_row public.services%rowtype;
  quote_id uuid;
  quote_number text := coalesce(nullif(payload ->> 'quote_number', ''), 'BMAS-Q-' || to_char(now(), 'YYYYMMDD') || '-' || floor(1000 + random() * 9000)::int::text);
  quote_status_value public.quote_status := 'Draft';
  selected_service_ids text[] := '{}';
  quantity_value numeric(14, 2);
  annual_salary_value numeric(14, 2);
  line_total_value numeric(14, 2);
  subtotal_value numeric(14, 2) := 0;
  bundle_discount_value numeric(14, 2) := 0;
  discount_value numeric(14, 2) := 0;
  taxable_value numeric(14, 2) := 0;
  vat_value numeric(14, 2) := 0;
  total_value numeric(14, 2) := 0;
  include_vat boolean := coalesce((options ->> 'include_vat')::boolean, true);
begin
  if payload is null or jsonb_typeof(payload -> 'items') <> 'array' or jsonb_array_length(payload -> 'items') = 0 then
    raise exception 'A quote must include at least one service item.';
  end if;

  if payload ->> 'status' in ('Draft', 'Submitted') then
    quote_status_value := (payload ->> 'status')::public.quote_status;
  end if;

  insert into public.quotes (
    quote_number,
    client_name,
    company_name,
    email,
    phone,
    industry,
    employee_count,
    subtotal,
    vat,
    discount,
    total,
    status
  ) values (
    quote_number,
    nullif(lead ->> 'name', ''),
    nullif(lead ->> 'company_name', ''),
    nullif(lead ->> 'email', ''),
    nullif(lead ->> 'phone', ''),
    nullif(lead ->> 'industry', ''),
    nullif(lead ->> 'employee_count', '')::integer,
    0,
    0,
    0,
    0,
    quote_status_value
  )
  returning id into quote_id;

  for item in select value from jsonb_array_elements(payload -> 'items') loop
    select *
    into service_row
    from public.services
    where id = item ->> 'service_id'
      and is_active = true;

    if not found then
      raise exception 'Unknown or inactive service: %', item ->> 'service_id';
    end if;

    quantity_value := coalesce(nullif(item ->> 'quantity', '')::numeric, service_row.minimum_quantity);
    quantity_value := greatest(quantity_value, service_row.minimum_quantity);
    quantity_value := least(quantity_value, service_row.maximum_quantity);

    annual_salary_value := nullif(item ->> 'annual_salary', '')::numeric;

    if service_row.pricing_type = 'percentage' then
      quantity_value := 1;
      annual_salary_value := greatest(coalesce(annual_salary_value, 0), 0);
      line_total_value := round(annual_salary_value * service_row.unit_price, 2);
    elsif service_row.pricing_type = 'negotiable' then
      line_total_value := 0;
    else
      line_total_value := round(quantity_value * service_row.unit_price, 2);
    end if;

    selected_service_ids := array_append(selected_service_ids, service_row.id);
    subtotal_value := subtotal_value + line_total_value;

    insert into public.quote_items (
      quote_id,
      service_id,
      service_name,
      category,
      description,
      pricing_type,
      quantity,
      annual_salary,
      unit_price,
      line_total
    ) values (
      quote_id,
      service_row.id,
      service_row.service_name,
      service_row.category,
      service_row.description,
      service_row.pricing_type,
      quantity_value,
      annual_salary_value,
      service_row.unit_price,
      line_total_value
    );
  end loop;

  select coalesce(sum(
    case
      when discount.discount_type = 'percentage' then subtotal_value * (discount.discount_value / 100)
      else discount.discount_value
    end
  ), 0)
  into bundle_discount_value
  from public.bundle_discounts discount
  where discount.is_active = true
    and discount.service_ids <@ selected_service_ids;

  discount_value := least(subtotal_value, bundle_discount_value);
  taxable_value := greatest(0, subtotal_value - discount_value);
  vat_value := case when include_vat then round(taxable_value * 0.16, 2) else 0 end;
  total_value := round(taxable_value + vat_value, 2);

  update public.quotes
  set subtotal = round(subtotal_value, 2),
      vat = vat_value,
      discount = round(discount_value, 2),
      total = total_value
  where id = quote_id;

  if coalesce(lead ->> 'name', lead ->> 'company_name', lead ->> 'email') is not null then
    insert into public.leads (name, company_name, email, phone, industry, employee_count)
    values (
      nullif(lead ->> 'name', ''),
      nullif(lead ->> 'company_name', ''),
      nullif(lead ->> 'email', ''),
      nullif(lead ->> 'phone', ''),
      nullif(lead ->> 'industry', ''),
      nullif(lead ->> 'employee_count', '')::integer
    );
  end if;

  return jsonb_build_object(
    'id', quote_id,
    'quote_number', quote_number,
    'totals', jsonb_build_object(
      'subtotal', round(subtotal_value, 2),
      'vat', vat_value,
      'discount', round(discount_value, 2),
      'total', total_value
    )
  );
end;
$$;

revoke all on function public.submit_service_quote(jsonb) from public;
grant execute on function public.submit_service_quote(jsonb) to anon, authenticated;
