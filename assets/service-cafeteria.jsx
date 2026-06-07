import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from './supabase-client.js';

const categories = [
  'Business Setup & Compliance',
  'Strategic Business Support',
  'HR & Payroll Solutions',
  'Human Resources Solutions',
  'Recruitment',
  'Training & Development',
];

const whatsappNumber = '2609722897789';

const seedServices = [
  ['name-search', 'Business Setup & Compliance', 'Name Search', 'Availability search and reservation support for business registration.', 'fixed', 350, 1, 1, ['tpin-registration'], 1],
  ['company-registration', 'Business Setup & Compliance', 'Company Registration', 'PACRA, NGO, or cooperative registration support from document preparation to submission.', 'fixed', 7000, 1, 1, ['name-search', 'tpin-registration', 'napsa-registration', 'nhima-registration', 'workers-comp-registration'], 2],
  ['tpin-registration', 'Business Setup & Compliance', 'TPIN Registration', 'ZRA TPIN setup support for a newly registered or existing business.', 'fixed', 900, 1, 1, ['napsa-registration'], 3],
  ['napsa-registration', 'Business Setup & Compliance', 'NAPSA Registration', 'Employer registration support for social security compliance.', 'fixed', 1200, 1, 1, ['nhima-registration', 'workers-comp-registration'], 4],
  ['nhima-registration', 'Business Setup & Compliance', 'NHIMA Registration', 'Employer registration support for national health insurance compliance.', 'fixed', 1200, 1, 1, ['payroll-setup'], 5],
  ['workers-comp-registration', 'Business Setup & Compliance', 'Workers Compensation Registration', 'Workers compensation registration guidance and filing support.', 'fixed', 1200, 1, 1, ['payroll-setup'], 6],
  ['company-profile-basic', 'Strategic Business Support', 'Company Profile Design', 'Professional company profile design for tenders, banks, and client presentations.', 'quantity', 1500, 1, 2, ['business-plan'], 7],
  ['business-plan', 'Strategic Business Support', 'Business Plan Development', 'Investor-ready business plan with practical market, operations, and financial sections.', 'quantity', 3000, 1, 3, ['financial-operational-review'], 8],
  ['financial-operational-review', 'Strategic Business Support', 'Financial and Operational Review', 'Structured review of operating performance, controls, and improvement priorities.', 'fixed', 6500, 1, 1, ['strategy-session'], 9],
  ['strategy-session', 'Strategic Business Support', 'Strategy Session', 'Focused advisory session for founders, managers, or leadership teams.', 'quantity', 950, 1, 12, ['hr-metrics-reports'], 10],
  ['payroll-setup', 'HR & Payroll Solutions', 'Payroll Setup', 'Initial payroll configuration with statutory compliance checks and payroll calendar setup.', 'fixed', 5500, 1, 1, ['napsa-registration', 'nhima-registration', 'employment-contracts'], 11],
  ['payroll-services', 'HR & Payroll Solutions', 'Payroll Services', 'Monthly payroll processing support, statutory schedules, and payroll reports.', 'monthly', 10200, 1, 24, ['employment-contracts', 'employee-handbook', 'hris-implementation', 'salary-benchmarking'], 12],
  ['hris-implementation', 'HR & Payroll Solutions', 'HRIS Implementation', 'Implementation support for employee records, leave, documents, workflows, and reporting.', 'fixed', 15000, 1, 1, ['payroll-services', 'hr-metrics-reports'], 13],
  ['bmas-staff-portal', 'HR & Payroll Solutions', 'BMAS Staff Portal', 'Annual access and implementation support for a central HR and staff self-service portal.', 'annual', 15000, 1, 3, ['hris-implementation'], 14],
  ['employment-contracts', 'Human Resources Solutions', 'Employment Contracts', 'Employment contract templates and role-specific contract preparation.', 'quantity', 2500, 1, 100, ['onboarding-support', 'employee-handbook'], 15],
  ['employee-handbook', 'Human Resources Solutions', 'Employee Handbook', 'Policy handbook aligned to practical HR operations and employer obligations.', 'fixed', 4000, 1, 1, ['hr-audit-policy'], 16],
  ['hr-audit-policy', 'Human Resources Solutions', 'HR Audit & Policy Development', 'HR compliance audit, gap report, and priority policy development.', 'fixed', 10000, 1, 1, ['compliance-review'], 17],
  ['compliance-review', 'Human Resources Solutions', 'Full Compliance Review', 'End-to-end review of HR, statutory, payroll, and employer compliance readiness.', 'fixed', 8500, 1, 1, ['hr-outsourcing', 'hr-metrics-reports'], 18],
  ['hr-outsourcing', 'Human Resources Solutions', 'HR Outsourcing', 'Monthly HR operations support, employee relations guidance, records, and advisory touchpoints.', 'monthly', 16500, 1, 24, ['engagement-surveys', 'hr-metrics-reports', 'training-needs-analysis'], 19],
  ['salary-benchmarking', 'Human Resources Solutions', 'Salary Benchmarking', 'Pay structure review and benchmark guidance for critical roles.', 'fixed', 4500, 1, 1, ['hr-metrics-reports'], 20],
  ['hr-metrics-reports', 'Human Resources Solutions', 'HR Metrics Reports', 'People analytics reports covering headcount, turnover, absenteeism, and payroll trends.', 'monthly', 3500, 1, 12, ['engagement-surveys'], 21],
  ['recruitment-service', 'Recruitment', 'Recruitment Service', 'Recruitment support priced as a percentage of annual gross salary.', 'percentage', 0.07, 1, 1, ['employment-contracts', 'onboarding-support', 'employee-handbook'], 22],
  ['recruitment-per-role', 'Recruitment', 'Recruitment Per Role', 'Role-based recruitment administration for entry and mid-level positions.', 'quantity', 1000, 1, 20, ['employment-contracts'], 23],
  ['onboarding-support', 'Recruitment', 'Onboarding Support', 'Practical onboarding pack, first-week plan, and hiring documentation support.', 'quantity', 1200, 1, 100, ['employee-handbook'], 24],
  ['training-program', 'Training & Development', 'Training Program', 'Employee training session priced per participant.', 'quantity', 1200, 1, 500, ['training-needs-analysis'], 25],
  ['training-needs-analysis', 'Training & Development', 'Training Needs Analysis', 'Structured assessment of skills gaps and priority learning needs.', 'fixed', 5000, 1, 1, ['training-program'], 26],
  ['engagement-surveys', 'Training & Development', 'Employee Engagement Surveys', 'Survey setup, administration, analysis, and recommendations report.', 'quantity', 350, 10, 1000, ['hr-metrics-reports'], 27],
  ['team-building', 'Training & Development', 'Team Building Activities', 'Custom team-building design and facilitation for staff groups.', 'negotiable', 0, 1, 1, ['training-program'], 28],
].map(([id, category, service_name, description, pricing_type, unit_price, minimum_quantity, maximum_quantity, recommended_services, display_order]) => ({
  id,
  category,
  service_name,
  description,
  pricing_type,
  unit_price,
  minimum_quantity,
  maximum_quantity,
  recommended_services,
  display_order,
  is_active: true,
}));

const dependencySeed = {
  'payroll-setup': ['napsa-registration', 'nhima-registration'],
  'company-registration': ['tpin-registration'],
  'recruitment-service': ['employment-contracts'],
};

const bundleSeed = [
  { id: 'setup-starter', bundle_name: 'Compliance Starter Bundle', service_ids: ['company-registration', 'napsa-registration', 'workers-comp-registration'], discount_type: 'percentage', discount_value: 7.5 },
  { id: 'payroll-ready', bundle_name: 'Payroll Ready Bundle', service_ids: ['payroll-setup', 'employment-contracts', 'employee-handbook'], discount_type: 'fixed', discount_value: 1000 },
  { id: 'outsourced-hr', bundle_name: 'Outsourced HR Growth Bundle', service_ids: ['hr-outsourcing', 'engagement-surveys', 'hr-metrics-reports'], discount_type: 'percentage', discount_value: 5 },
];

function money(value) {
  return `K${Number(value || 0).toLocaleString('en-ZM', { maximumFractionDigits: 2 })}`;
}

function quoteNo() {
  return `BMAS-Q-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function today(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function priceText(service) {
  if (service.pricing_type === 'negotiable') return 'Price Upon Request';
  if (service.pricing_type === 'percentage') return `${Math.round(service.unit_price * 100)}% of annual gross salary`;
  if (service.pricing_type === 'monthly') return `${money(service.unit_price)} / month`;
  if (service.pricing_type === 'annual') return `${money(service.unit_price)} / year`;
  return money(service.unit_price);
}

function serviceRequestLabel(service) {
  if (service.pricing_type === 'percentage') return 'Annual salary needed';
  if (service.pricing_type === 'negotiable') return 'Scope discussion needed';
  if (service.maximum_quantity > service.minimum_quantity) return 'Quantity needed';
  return 'Fixed fee';
}

function clampQuantity(value, min = 1, max = 999) {
  const numeric = Number(value || min);
  return Math.min(Math.max(numeric, Number(min || 1)), Number(max || 999));
}

function lineTotal(item) {
  if (item.pricing_type === 'negotiable') return 0;
  if (item.pricing_type === 'percentage') return Math.round(Number(item.annualSalary || 0) * Number(item.unit_price || 0) * 100) / 100;
  return Math.round(clampQuantity(item.quantity, item.minimum_quantity, item.maximum_quantity) * Number(item.unit_price || 0) * 100) / 100;
}

function quotationDetail(item) {
  if (item.pricing_type === 'percentage') return `Salary: ${money(item.annualSalary || 0)}`;
  if (item.pricing_type === 'negotiable') return 'Scope to confirm';
  return `Qty: ${clampQuantity(item.quantity, item.minimum_quantity, item.maximum_quantity)}`;
}

function calculateTotals(cart, bundles, includeVat = true) {
  const selectedIds = cart.map((item) => item.id);
  const subtotal = cart.reduce((sum, item) => sum + lineTotal(item), 0);
  const bundleDiscount = bundles
    .filter((bundle) => bundle.is_active !== false)
    .filter((bundle) => (bundle.service_ids || []).every((id) => selectedIds.includes(id)))
    .reduce((sum, bundle) => {
      if (bundle.discount_type === 'percentage') return sum + subtotal * (Number(bundle.discount_value || 0) / 100);
      return sum + Number(bundle.discount_value || 0);
    }, 0);
  const discount = Math.min(subtotal, bundleDiscount);
  const taxable = Math.max(0, subtotal - discount);
  const vat = includeVat ? Math.round(taxable * 0.16 * 100) / 100 : 0;
  const total = Math.round((taxable + vat) * 100) / 100;
  return { subtotal, discount, vat, total };
}

function App() {
  const [services, setServices] = useState(seedServices);
  const [dependencies, setDependencies] = useState(dependencySeed);
  const [bundles, setBundles] = useState(bundleSeed);
  const [cart, setCart] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [lead, setLead] = useState({ name: '', company_name: '', email: '', phone: '', industry: '', employee_count: '' });
  const [notes, setNotes] = useState('Please prepare a BMAS quotation for the selected services.');
  const [db, setDb] = useState(null);
  const [message, setMessage] = useState('');
  const hasServiceFilter = category !== 'All' || query.trim().length > 0;

  useEffect(() => {
    let mounted = true;
    async function bootSupabase() {
      try {
        const response = await fetch('/api/quiz-config');
        if (!response.ok) return;
        const config = await response.json();
        if (!config.supabaseConfigured) return;
        const client = createClient(config.supabaseUrl, config.supabaseAnonKey);
        setDb(client);
        const [serviceResult, dependencyResult, recommendationResult, bundleResult] = await Promise.all([
          client.from('services').select('*').eq('is_active', true).order('display_order'),
          client.from('service_dependencies').select('service_id, depends_on_service_id'),
          client.from('service_recommendations').select('service_id, recommended_service_id'),
          client.from('bundle_discounts').select('*').eq('is_active', true),
        ]);
        if (!mounted) return;
        const nextServices = serviceResult.data?.length ? serviceResult.data : seedServices;
        if (!serviceResult.error && serviceResult.data?.length) setServices(serviceResult.data);
        if (!dependencyResult.error && dependencyResult.data?.length) {
          setDependencies(groupRelations(dependencyResult.data, 'depends_on_service_id'));
        }
        if (!recommendationResult.error && recommendationResult.data?.length) {
          const recMap = groupRelations(recommendationResult.data, 'recommended_service_id');
          setServices(nextServices.map((service) => ({
            ...service,
            recommended_services: recMap[service.id] || service.recommended_services || [],
          })));
        }
        if (!bundleResult.error && bundleResult.data?.length) setBundles(bundleResult.data);
      } catch (_error) {
      }
    }
    bootSupabase();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedIds = cart.map((item) => item.id);
  const filtered = useMemo(() => {
    if (!hasServiceFilter) return [];
    return services
      .filter((service) => service.is_active !== false)
      .filter((service) => category === 'All' || service.category === category)
      .filter((service) => `${service.service_name} ${service.description} ${service.category}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
  }, [services, category, query, hasServiceFilter]);

  const recommendations = useMemo(() => {
    const ids = new Set();
    cart.forEach((item) => {
      (item.recommended_services || []).forEach((id) => ids.add(id));
      (dependencies[item.id] || []).forEach((id) => ids.add(id));
    });
    return services.filter((service) => ids.has(service.id) && !selectedIds.includes(service.id)).slice(0, 8);
  }, [cart, dependencies, selectedIds, services]);

  const requestSummary = useMemo(() => {
    const activeBundles = bundles.filter((bundle) => (bundle.service_ids || []).every((id) => selectedIds.includes(id)));
    const quantityInputs = cart.filter((item) => item.pricing_type !== 'percentage' && item.pricing_type !== 'negotiable' && item.maximum_quantity > item.minimum_quantity).length;
    const salaryInputs = cart.filter((item) => item.pricing_type === 'percentage').length;
    return { activeBundles, quantityInputs, salaryInputs };
  }, [bundles, cart, selectedIds]);

  const totals = useMemo(() => calculateTotals(cart, bundles), [cart, bundles]);

  function addService(service) {
    setCart((items) => {
      if (items.some((item) => item.id === service.id)) return items;
      return [...items, { ...service, quantity: service.minimum_quantity || 1, annualSalary: 0 }];
    });
  }

  function updateItem(id, patch) {
    setCart((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function quotePayload(quoteNumber, nextStatus) {
    return {
      quote_number: quoteNumber,
      lead,
      notes,
      status: nextStatus,
      options: { include_vat: true },
      items: cart.map((item) => ({
        service_id: item.id,
        quantity: item.pricing_type === 'percentage' ? 1 : Number(item.quantity || item.minimum_quantity || 1),
        annual_salary: item.pricing_type === 'percentage' ? Number(item.annualSalary || 0) : null,
      })),
    };
  }

  function createLocalQuote(nextStatus = 'Submitted', serverQuote = {}) {
    return {
      id: crypto.randomUUID(),
      quote_number: serverQuote.quote_number || quoteNo(),
      lead,
      notes,
      status: nextStatus,
      cart,
      totals: serverQuote.totals || totals,
      created_at: new Date().toISOString(),
    };
  }

  async function persistQuote(nextStatus = 'Submitted') {
    const quoteNumber = quoteNo();
    if (!db) {
      return createLocalQuote(nextStatus, { quote_number: quoteNumber });
    }
    try {
      const { data, error } = await db.rpc('submit_service_quote', { payload: quotePayload(quoteNumber, nextStatus) });
      if (error) throw error;
      const quote = createLocalQuote(nextStatus, data || { quote_number: quoteNumber });
      setMessage(`Request submitted as ${quote.quote_number}.`);
      return quote;
    } catch (error) {
      setMessage('We could not submit the quotation online. The PDF/WhatsApp flow still works, but please contact BMAS if you need immediate assistance.');
      return createLocalQuote(nextStatus, { quote_number: quoteNumber });
    }
  }

  async function downloadPdf() {
    if (!lead.name || !lead.email || !lead.company_name) {
      setMessage('Add client name, company, and email before downloading.');
      return;
    }
    const quote = await persistQuote('Submitted');
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const logo = await imageDataUrl('bmas.png');
      if (logo) doc.addImage(logo, 'PNG', 14, 12, 22, 22);
      doc.setFontSize(17);
      doc.text('BMAS Service Quotation', 42, 22);
      doc.setFontSize(10);
      doc.text(`Quote: ${quote.quote_number}`, 14, 44);
      doc.text(`Date: ${today()}`, 14, 50);
      doc.text(`Expiry: ${today(14)}`, 14, 56);
      doc.text(`Client: ${lead.name} | ${lead.company_name}`, 105, 44);
      doc.text(`Email: ${lead.email}`, 105, 50);
      doc.text(`Phone: ${lead.phone || 'Not provided'}`, 105, 56);
      let y = 72;
      doc.setFont(undefined, 'bold');
      doc.text('Service', 14, y);
      doc.text('Details', 84, y);
      doc.text('Unit', 130, y);
      doc.text('Total', 170, y);
      doc.setFont(undefined, 'normal');
      cart.forEach((item) => {
        y += 8;
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        doc.text(item.service_name.slice(0, 34), 14, y);
        const detail = item.pricing_type === 'percentage'
          ? `Salary: ${money(item.annualSalary || 0)}`
          : quotationDetail(item);
        doc.text(detail.slice(0, 24), 84, y);
        doc.text(priceText(item).slice(0, 20), 130, y);
        doc.text(item.pricing_type === 'negotiable' ? 'TBC' : money(lineTotal(item)), 170, y);
      });
      y += 12;
      doc.line(14, y, 196, y);
      y += 8;
      doc.setFont(undefined, 'bold');
      doc.text('Subtotal', 130, y);
      doc.text(money(quote.totals?.subtotal || totals.subtotal), 170, y);
      y += 7;
      doc.text('Bundle discount', 130, y);
      doc.text(`-${money(quote.totals?.discount || totals.discount)}`, 170, y);
      y += 7;
      doc.text('VAT 16%', 130, y);
      doc.text(money(quote.totals?.vat || totals.vat), 170, y);
      y += 8;
      doc.setFontSize(12);
      doc.text('Total', 130, y);
      doc.text(money(quote.totals?.total || totals.total), 170, y);
      y += 12;
      doc.setFontSize(10);
      doc.text('This quotation is generated from the BMAS self-service quotation builder.', 14, y);
      doc.setFont(undefined, 'normal');
      doc.text('Notes:', 14, y + 14);
      doc.text(doc.splitTextToSize(notes, 180), 14, y + 21);
      doc.save(`${quote.quote_number}.pdf`);
      setMessage(`Quotation ${quote.quote_number} downloaded. You can now send it to BMAS on WhatsApp.`);
    } catch (_error) {
      window.print();
    }
  }

  async function sendToWhatsApp() {
    if (cart.length === 0) {
      setMessage('Select at least one service before contacting BMAS.');
      return;
    }
    const quote = await persistQuote('Submitted');
    const total = money(quote.totals?.total || totals.total);
    const client = lead.company_name || lead.name || 'my company';
    const messageText = `Hello BMAS, I generated quotation ${quote.quote_number} for ${client}. The quoted total is ${total}. I would like to discuss the next steps.`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(messageText)}`, '_blank', 'noopener');
  }

  return (
    <div className="cafeteria-shell">
      <section className="cafeteria-hero">
        <div className="cafeteria-hero-inner cafeteria-hero-layout mx-auto grid max-w-6xl gap-8 px-6 py-12">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">BMAS HR Service Cafeteria</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight md:text-5xl">Build your BMAS quotation.</h1>
            <p className="cafeteria-hero-copy mt-4 max-w-2xl">Choose a service area, add the services you need, and generate a quotation you can download or send to BMAS for next steps.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#quotation-builder" className="rounded bg-amber-400 px-5 py-3 font-semibold text-slate-950">Select Services</a>
            </div>
          </div>
          <div className="cafeteria-metric-panel rounded-lg p-5">
            <img src="bmas.png" alt="BMAS logo" className="h-16 w-16 rounded-full bg-black object-contain p-1" />
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Active Services" value={services.filter((item) => item.is_active !== false).length} />
              <Metric label="Selected" value={cart.length} />
              <Metric label="Bundles" value={requestSummary.activeBundles.length} />
              <Metric label="Total" value={money(totals.total)} />
            </div>
          </div>
        </div>
      </section>

      <div id="quotation-builder" className="mx-auto max-w-6xl px-6 py-8">
        {message && <div className="cafeteria-note mt-4 rounded border px-4 py-3 text-sm">{message}</div>}

        <div className="cafeteria-builder-grid mt-6 grid gap-6">
            <section>
              <div className="cafeteria-filter-grid cafeteria-surface grid gap-3 rounded-lg border p-4 shadow-sm">
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services" className="rounded border px-3 py-2" />
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded border px-3 py-2">
                  <option value="All">Choose service area</option>
                  {categories.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              {!hasServiceFilter && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {categories.map((item) => (
                    <button key={item} onClick={() => setCategory(item)} className="cafeteria-category-tile cafeteria-surface rounded-lg border p-4 text-left shadow-sm">
                      <span className="text-sm font-bold text-slate-950">{item}</span>
                      <span className="mt-2 block text-xs text-slate-500">View matching services</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {filtered.map((service) => (
                  <article key={service.id} className="cafeteria-service-card cafeteria-surface flex flex-col rounded-lg border p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <span className="cafeteria-category-badge rounded px-2 py-1 text-xs font-semibold">{service.category}</span>
                      <span className="text-xs font-semibold uppercase text-slate-500">{serviceRequestLabel(service)}</span>
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-slate-950">{service.service_name}</h2>
                    <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{service.description}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold text-slate-800">{priceText(service)}</span>
                      <button onClick={() => addService(service)} className="cafeteria-primary rounded px-4 py-2 text-sm font-semibold disabled:bg-slate-300" disabled={selectedIds.includes(service.id)}>
                        {selectedIds.includes(service.id) ? 'Selected' : 'Select'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <section className="cafeteria-surface rounded-lg border p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Quotation</h2>
                  <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{cart.length} services</span>
                </div>
                <div className="mt-4 space-y-3">
                  {cart.length === 0 && <p className="text-sm text-slate-500">Select services from the catalogue to begin.</p>}
                  {cart.map((item) => (
                    <div key={item.id} className="rounded border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900">{item.service_name}</div>
                          <div className="text-xs text-slate-500">{item.category}</div>
                        </div>
                        <button onClick={() => setCart((items) => items.filter((next) => next.id !== item.id))} className="rounded border px-2 py-1 text-xs">Remove</button>
                      </div>
                      {item.pricing_type === 'percentage' ? (
                        <input type="number" min="0" value={item.annualSalary || ''} onChange={(event) => updateItem(item.id, { annualSalary: Number(event.target.value) })} placeholder="Annual gross salary" className="mt-3 w-full rounded border px-3 py-2 text-sm" />
                      ) : item.pricing_type !== 'negotiable' && (
                        <input type="number" min={item.minimum_quantity || 1} max={item.maximum_quantity || 999} value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} className="mt-3 w-full rounded border px-3 py-2 text-sm" />
                      )}
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-slate-500">{priceText(item)}</span>
                        <strong>{item.pricing_type === 'negotiable' ? 'TBC' : money(lineTotal(item))}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3 border-t pt-4 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
                  <div className="flex justify-between"><span>Bundle discount</span><strong>-{money(totals.discount)}</strong></div>
                  <div className="flex justify-between"><span>VAT 16%</span><strong>{money(totals.vat)}</strong></div>
                  <div className="flex justify-between border-t pt-3 text-base text-slate-950"><span>Total</span><strong>{money(totals.total)}</strong></div>
                  {(requestSummary.quantityInputs > 0 || requestSummary.salaryInputs > 0) && <div className="cafeteria-note rounded p-3">Adjust quantities or salary inputs to update your quotation total.</div>}
                  <button onClick={sendToWhatsApp} disabled={cart.length === 0} className="cafeteria-whatsapp-btn w-full rounded px-4 py-2.5 text-sm font-semibold disabled:opacity-40">
                    Send quotation to WhatsApp
                  </button>
                </div>
                {requestSummary.activeBundles.length > 0 && (
                  <div className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Bundle match:</strong> {requestSummary.activeBundles.map((bundle) => bundle.bundle_name).join(', ')}
                  </div>
                )}
              </section>

              {recommendations.length > 0 && (
                <section className="cafeteria-surface rounded-lg border p-5 shadow-sm">
                  <h2 className="font-bold text-slate-950">Frequently Selected Together</h2>
                  <div className="mt-3 space-y-2">
                    {recommendations.map((service) => (
                      <button key={service.id} onClick={() => addService(service)} className="flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm hover:bg-slate-50">
                        <span>{service.service_name}</span>
                        <span className="cafeteria-accent font-semibold">Add</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <LeadPanel lead={lead} setLead={setLead} notes={notes} setNotes={setNotes} downloadPdf={downloadPdf} cart={cart} totals={totals} />
            </aside>
        </div>
      </div>
    </div>
  );
}

function groupRelations(rows, targetKey) {
  return rows.reduce((map, row) => {
    const current = map[row.service_id] || [];
    return { ...map, [row.service_id]: [...current, row[targetKey]] };
  }, {});
}

function imageDataUrl(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve('');
    image.src = src;
  });
}

function Metric({ label, value }) {
  return <div className="rounded border border-white/15 bg-white/10 p-3"><div className="text-xs uppercase tracking-wide text-white/65">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>;
}

function LeadPanel({ lead, setLead, notes, setNotes, downloadPdf, cart, totals }) {
  const fields = [
    ['name', 'Client Name'],
    ['company_name', 'Company Name'],
    ['email', 'Email'],
    ['phone', 'Phone Number'],
    ['industry', 'Industry'],
    ['employee_count', 'Number of Employees'],
  ];
  return (
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-950">Quotation Details</h2>
      <div className="mt-3 grid gap-3">
        {fields.map(([key, label]) => (
          <input key={key} value={lead[key]} onChange={(event) => setLead({ ...lead, [key]: event.target.value })} placeholder={label} className="rounded border px-3 py-2 text-sm" />
        ))}
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="3" className="rounded border px-3 py-2 text-sm" />
      </div>
      <div className="mt-4">
        <button onClick={downloadPdf} disabled={cart.length === 0} className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Download PDF</button>
      </div>
      <div className="mt-3 text-right text-sm text-slate-600">
        Quotation total: <strong className="text-slate-950">{money(totals.total)}</strong>
      </div>
    </section>
  );
}

createRoot(document.getElementById('service-cafeteria-root')).render(<App />);
