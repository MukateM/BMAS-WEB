(function () {
  const percent = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
  const number = (value, suffix = '') => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`;
  const money = (value) => `K${Number(value || 0).toLocaleString('en-ZM', { maximumFractionDigits: 2 })}`;

  const metrics = [
    {
      id: 'turnover',
      category: 'Workforce Stability',
      name: 'Employee Turnover Rate (%)',
      measures: 'Percentage of employees who leave the organization during a period.',
      formula: '(Employees Separated / Average Headcount) x 100',
      inputs: [
        ['separated', 'Employees Separated'],
        ['averageHeadcount', 'Average Headcount'],
      ],
      calculate: ({ separated, averageHeadcount }) => (separated / averageHeadcount) * 100,
      format: percent,
    },
    {
      id: 'retention',
      category: 'Workforce Stability',
      name: 'Employee Retention Rate (%)',
      measures: 'Ability of the organization to retain employees.',
      formula: '((Ending Headcount - New Hires) / Beginning Headcount) x 100',
      inputs: [
        ['endingHeadcount', 'Ending Headcount'],
        ['newHires', 'New Hires'],
        ['beginningHeadcount', 'Beginning Headcount'],
      ],
      calculate: ({ endingHeadcount, newHires, beginningHeadcount }) => ((endingHeadcount - newHires) / beginningHeadcount) * 100,
      format: percent,
    },
    {
      id: 'time-to-fill',
      category: 'Talent Acquisition',
      name: 'Time to Fill',
      measures: 'Average number of days taken to fill a vacancy.',
      formula: 'Total Days to Fill Positions / Number of Positions Filled',
      inputs: [
        ['daysToFill', 'Total Days to Fill Positions'],
        ['positionsFilled', 'Number of Positions Filled'],
      ],
      calculate: ({ daysToFill, positionsFilled }) => daysToFill / positionsFilled,
      format: (value) => number(value, ' days'),
    },
    {
      id: 'cost-per-hire',
      category: 'Talent Acquisition',
      name: 'Cost per Hire',
      measures: 'Average recruitment cost per employee hired.',
      formula: 'Total Recruitment Costs / Total Hires',
      inputs: [
        ['recruitmentCosts', 'Total Recruitment Costs'],
        ['totalHires', 'Total Hires'],
      ],
      calculate: ({ recruitmentCosts, totalHires }) => recruitmentCosts / totalHires,
      format: money,
    },
    {
      id: 'quality-of-hire',
      category: 'Talent Acquisition',
      name: 'Quality of Hire (%)',
      measures: 'Measures effectiveness and performance of new hires.',
      formula: '(Performance Score + Hiring Manager Satisfaction + Retention Score) / 3',
      inputs: [
        ['performanceScore', 'Performance Score (%)'],
        ['managerSatisfaction', 'Hiring Manager Satisfaction (%)'],
        ['retentionScore', 'Retention Score (%)'],
      ],
      calculate: ({ performanceScore, managerSatisfaction, retentionScore }) => (performanceScore + managerSatisfaction + retentionScore) / 3,
      format: percent,
    },
    {
      id: 'offer-acceptance',
      category: 'Talent Acquisition',
      name: 'Offer Acceptance Rate (%)',
      measures: 'Percentage of candidates who accept offers.',
      formula: '(Offers Accepted / Total Offers Extended) x 100',
      inputs: [
        ['offersAccepted', 'Offers Accepted'],
        ['offersExtended', 'Total Offers Extended'],
      ],
      calculate: ({ offersAccepted, offersExtended }) => (offersAccepted / offersExtended) * 100,
      format: percent,
    },
    {
      id: 'new-hire-turnover',
      category: 'Talent Acquisition',
      name: 'New Hire Turnover Rate (%)',
      measures: 'Percentage of new hires leaving within the first year.',
      formula: '(New Hires Who Left / Total New Hires) x 100',
      inputs: [
        ['newHiresLeft', 'New Hires Who Left'],
        ['totalNewHires', 'Total New Hires'],
      ],
      calculate: ({ newHiresLeft, totalNewHires }) => (newHiresLeft / totalNewHires) * 100,
      format: percent,
    },
    {
      id: 'performance-appraisal',
      category: 'Performance',
      name: 'Performance Appraisal Score (%)',
      measures: 'Average employee performance rating.',
      formula: '(Total Performance Scores / Maximum Possible Scores) x 100',
      inputs: [
        ['totalPerformanceScores', 'Total Performance Scores'],
        ['maximumPerformanceScores', 'Maximum Possible Scores'],
      ],
      calculate: ({ totalPerformanceScores, maximumPerformanceScores }) => (totalPerformanceScores / maximumPerformanceScores) * 100,
      format: percent,
    },
    {
      id: 'engagement',
      category: 'Employee Experience',
      name: 'Employee Engagement Score (%)',
      measures: 'Measures commitment and emotional connection to the organization.',
      formula: '(Total Engagement Score / Maximum Possible Score) x 100',
      inputs: [
        ['engagementScore', 'Total Engagement Score'],
        ['maximumEngagementScore', 'Maximum Possible Score'],
      ],
      calculate: ({ engagementScore, maximumEngagementScore }) => (engagementScore / maximumEngagementScore) * 100,
      format: percent,
    },
    {
      id: 'wellbeing',
      category: 'Employee Experience',
      name: 'Employee Wellbeing Index (%)',
      measures: 'Measures employee wellbeing, workload balance, and wellness.',
      formula: '(Wellbeing Survey Score / Maximum Possible Score) x 100',
      inputs: [
        ['wellbeingScore', 'Wellbeing Survey Score'],
        ['maximumWellbeingScore', 'Maximum Possible Score'],
      ],
      calculate: ({ wellbeingScore, maximumWellbeingScore }) => (wellbeingScore / maximumWellbeingScore) * 100,
      format: percent,
    },
    {
      id: 'absenteeism',
      category: 'Attendance',
      name: 'Absenteeism Rate (%)',
      measures: 'Tracks employee absence from work.',
      formula: '(Total Days Absent / Total Available Workdays) x 100',
      inputs: [
        ['daysAbsent', 'Total Days Absent'],
        ['availableWorkdays', 'Total Available Workdays'],
      ],
      calculate: ({ daysAbsent, availableWorkdays }) => (daysAbsent / availableWorkdays) * 100,
      format: percent,
    },
    {
      id: 'training-effectiveness',
      category: 'Learning & Development',
      name: 'Training Effectiveness (%)',
      measures: 'Measures improvement after training.',
      formula: '((Post-Test Score - Pre-Test Score) / Pre-Test Score) x 100',
      inputs: [
        ['postTestScore', 'Post-Test Score'],
        ['preTestScore', 'Pre-Test Score'],
      ],
      calculate: ({ postTestScore, preTestScore }) => ((postTestScore - preTestScore) / preTestScore) * 100,
      format: percent,
    },
    {
      id: 'internal-promotion',
      category: 'Talent Management',
      name: 'Internal Promotion Rate (%)',
      measures: 'Measures success of internal talent development.',
      formula: '(Number of Promotions / Total Employees) x 100',
      inputs: [
        ['promotions', 'Number of Promotions'],
        ['totalEmployees', 'Total Employees'],
      ],
      calculate: ({ promotions, totalEmployees }) => (promotions / totalEmployees) * 100,
      format: percent,
    },
    {
      id: 'succession-coverage',
      category: 'Talent Management',
      name: 'Succession Coverage Ratio (%)',
      measures: 'Readiness for critical positions.',
      formula: '(Critical Roles with Ready Successors / Total Critical Roles) x 100',
      inputs: [
        ['rolesWithSuccessors', 'Critical Roles with Ready Successors'],
        ['criticalRoles', 'Total Critical Roles'],
      ],
      calculate: ({ rolesWithSuccessors, criticalRoles }) => (rolesWithSuccessors / criticalRoles) * 100,
      format: percent,
    },
    {
      id: 'revenue-per-employee',
      category: 'Productivity',
      name: 'Revenue per Employee',
      measures: 'Workforce productivity and business contribution.',
      formula: 'Total Revenue / Average Headcount',
      inputs: [
        ['totalRevenue', 'Total Revenue'],
        ['averageHeadcount', 'Average Headcount'],
      ],
      calculate: ({ totalRevenue, averageHeadcount }) => totalRevenue / averageHeadcount,
      format: money,
    },
    {
      id: 'enps',
      category: 'Employee Experience',
      name: 'Employee Net Promoter Score (eNPS)',
      measures: "Measures employees' willingness to recommend the organization as a place to work.",
      formula: '% Promoters - % Detractors',
      inputs: [
        ['promoters', 'Promoters (%)'],
        ['detractors', 'Detractors (%)'],
      ],
      calculate: ({ promoters, detractors }) => promoters - detractors,
      format: (value) => number(value),
    },
    {
      id: 'high-performer-retention',
      category: 'Performance',
      name: 'High Performer Retention Rate (%)',
      measures: "Measures the organization's ability to retain top-performing employees.",
      formula: '(High Performers Retained / Total High Performers) x 100',
      inputs: [
        ['retainedHighPerformers', 'High Performers Retained'],
        ['totalHighPerformers', 'Total High Performers'],
      ],
      calculate: ({ retainedHighPerformers, totalHighPerformers }) => (retainedHighPerformers / totalHighPerformers) * 100,
      format: percent,
    },
    {
      id: 'internal-mobility',
      category: 'Talent Management',
      name: 'Internal Mobility Rate (%)',
      measures: 'Measures movement of employees into new roles, departments, or career opportunities within the organization.',
      formula: '(Employees Who Changed Roles Internally / Total Employees) x 100',
      inputs: [
        ['internalRoleChanges', 'Employees Who Changed Roles Internally'],
        ['totalEmployees', 'Total Employees'],
      ],
      calculate: ({ internalRoleChanges, totalEmployees }) => (internalRoleChanges / totalEmployees) * 100,
      format: percent,
    },
    {
      id: 'manager-effectiveness',
      category: 'Performance',
      name: 'Manager Effectiveness Score (%)',
      measures: 'Measures leadership effectiveness based on employee feedback and management assessments.',
      formula: '(Total Manager Evaluation Score / Maximum Possible Score) x 100',
      inputs: [
        ['managerEvaluationScore', 'Total Manager Evaluation Score'],
        ['maximumManagerScore', 'Maximum Possible Score'],
      ],
      calculate: ({ managerEvaluationScore, maximumManagerScore }) => (managerEvaluationScore / maximumManagerScore) * 100,
      format: percent,
    },
    {
      id: 'skills-gap',
      category: 'Learning & Development',
      name: 'Skills Gap Index (%)',
      measures: 'Measures the gap between required workforce skills and available skills.',
      formula: '((Required Skills - Available Skills) / Required Skills) x 100',
      inputs: [
        ['requiredSkills', 'Required Skills'],
        ['availableSkills', 'Available Skills'],
      ],
      calculate: ({ requiredSkills, availableSkills }) => ((requiredSkills - availableSkills) / requiredSkills) * 100,
      format: percent,
    },
  ];

  const form = document.getElementById('hrMetricsForm');
  const select = document.getElementById('metricSelect');
  const inputWrap = document.getElementById('metricInputs');
  const context = document.getElementById('metricContext');
  const resultValue = document.getElementById('metricResultValue');
  const resultLabel = document.getElementById('metricResultLabel');
  const resultMeaning = document.getElementById('metricResultMeaning');
  const resultFormula = document.getElementById('metricResultFormula');
  const clearButton = document.getElementById('clearHrMetrics');
  const library = document.getElementById('metricLibrary');
  const search = document.getElementById('metricSearch');

  if (!form || !select || !inputWrap || !context || !resultValue || !resultLabel || !resultMeaning || !resultFormula || !library) return;

  function currentMetric() {
    return metrics.find((metric) => metric.id === select.value) || metrics[0];
  }

  function renderMetricOptions() {
    select.innerHTML = metrics.map((metric) => `<option value="${metric.id}">${metric.name}</option>`).join('');
  }

  function renderInputs() {
    const metric = currentMetric();
    context.innerHTML = `
      <div class="font-semibold text-slate-900">${metric.category}</div>
      <p class="mt-1">${metric.measures}</p>
    `;
    inputWrap.innerHTML = metric.inputs.map(([key, label]) => `
      <label class="block text-sm">
        <span class="font-medium text-slate-700">${label}</span>
        <input name="${key}" type="number" min="0" step="0.01" class="mt-1 w-full rounded border px-3 py-2" required />
      </label>
    `).join('');
    resultValue.textContent = '--';
    resultLabel.textContent = metric.name;
    resultMeaning.textContent = metric.measures;
    resultFormula.textContent = metric.formula;
  }

  function readInputs(metric) {
    return metric.inputs.reduce((values, [key]) => {
      values[key] = Number(new FormData(form).get(key));
      return values;
    }, {});
  }

  function renderLibrary() {
    const query = String(search?.value || '').trim().toLowerCase();
    const filtered = metrics.filter((metric) =>
      `${metric.name} ${metric.category} ${metric.measures} ${metric.formula}`.toLowerCase().includes(query),
    );

    library.innerHTML = filtered.map((metric) => `
      <article class="rounded-lg border bg-slate-50 p-4">
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">${metric.category}</div>
        <h3 class="mt-2 font-bold text-slate-950">${metric.name}</h3>
        <p class="mt-2 text-sm leading-6 text-slate-600">${metric.measures}</p>
        <div class="mt-3 rounded bg-white p-3 text-xs text-slate-600">${metric.formula}</div>
        <button type="button" data-metric="${metric.id}" class="mt-3 rounded border px-3 py-1.5 text-sm font-semibold hover:bg-white">Calculate this</button>
      </article>
    `).join('');
  }

  renderMetricOptions();
  renderInputs();
  renderLibrary();

  select.addEventListener('change', renderInputs);
  search?.addEventListener('input', renderLibrary);

  library.addEventListener('click', (event) => {
    const button = event.target.closest('[data-metric]');
    if (!button) return;
    select.value = button.dataset.metric;
    renderInputs();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  clearButton?.addEventListener('click', () => {
    form.reset();
    renderInputs();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const metric = currentMetric();
    const values = readInputs(metric);
    const result = metric.calculate(values);

    if (!Number.isFinite(result)) {
      resultValue.textContent = '--';
      resultLabel.textContent = 'Check your inputs';
      resultMeaning.textContent = 'Make sure denominator fields are greater than zero.';
      resultFormula.textContent = metric.formula;
      return;
    }

    resultValue.textContent = metric.format(result);
    resultLabel.textContent = metric.name;
    resultMeaning.textContent = metric.measures;
    resultFormula.textContent = metric.formula;
  });
})();
