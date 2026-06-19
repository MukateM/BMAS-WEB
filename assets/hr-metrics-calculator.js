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
  const clearReportButton = document.getElementById('clearHrReport');
  const reportList = document.getElementById('metricReportList');
  const reportEmpty = document.getElementById('metricReportEmpty');

  if (!form || !select || !inputWrap || !context || !resultValue || !resultLabel || !resultMeaning || !resultFormula) return;

  const savedCalculations = [];

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

  function renderReportList() {
    if (!reportList || !reportEmpty) return;
    reportList.textContent = '';
    reportEmpty.classList.toggle('hidden', savedCalculations.length > 0);

    savedCalculations.forEach((item, index) => {
      const row = document.createElement('article');
      row.className = 'rounded border bg-slate-50 p-4';

      const top = document.createElement('div');
      top.className = 'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between';

      const text = document.createElement('div');
      const category = document.createElement('div');
      category.className = 'text-xs font-semibold uppercase tracking-[0.14em] text-amber-700';
      category.textContent = item.category;
      const title = document.createElement('h3');
      title.className = 'mt-1 font-bold text-slate-950';
      title.textContent = item.name;
      const meaning = document.createElement('p');
      meaning.className = 'mt-1 text-sm leading-6 text-slate-600';
      meaning.textContent = item.meaning;
      text.appendChild(category);
      text.appendChild(title);
      text.appendChild(meaning);

      const valueWrap = document.createElement('div');
      valueWrap.className = 'shrink-0 text-left sm:text-right';
      const value = document.createElement('div');
      value.className = 'text-2xl font-extrabold text-slate-950';
      value.textContent = item.value;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'mt-2 text-sm font-semibold text-slate-500 hover:text-slate-900';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        savedCalculations.splice(index, 1);
        renderReportList();
      });
      valueWrap.appendChild(value);
      valueWrap.appendChild(remove);

      top.appendChild(text);
      top.appendChild(valueWrap);

      const formula = document.createElement('div');
      formula.className = 'mt-3 rounded bg-white p-3 text-xs text-slate-600';
      formula.textContent = item.formula;

      row.appendChild(top);
      row.appendChild(formula);
      reportList.appendChild(row);
    });
  }

  function saveCalculation(metric, values, result) {
    savedCalculations.push({
      category: metric.category,
      name: metric.name,
      value: metric.format(result),
      meaning: metric.measures,
      formula: metric.formula,
      inputs: metric.inputs.map(([key, label]) => ({
        label,
        value: values[key],
      })),
    });
    renderReportList();
  }

  function loadWatermarkDataUrl() {
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 900;
        canvas.height = 900;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 0.07;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => resolve('');
      image.src = 'bmas.png';
    });
  }

  renderMetricOptions();
  renderInputs();
  renderReportList();

  select.addEventListener('change', renderInputs);

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
    saveCalculation(metric, values, result);
  });

  clearReportButton?.addEventListener('click', () => {
    savedCalculations.splice(0, savedCalculations.length);
    renderReportList();
  });

  document.getElementById('downloadHrReport')?.addEventListener('click', async () => {
    if (savedCalculations.length === 0) {
      alert('Add at least one calculated metric before downloading a summary.');
      return;
    }

    try {
      const { jsPDF } = await import('jspdf');
      const watermark = await loadWatermarkDataUrl();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      const addWatermark = () => {
        if (!watermark) return;
        const size = Math.min(pageWidth, pageHeight) * 0.56;
        const x = (pageWidth - size) / 2;
        const yPos = (pageHeight - size) / 2;
        doc.addImage(watermark, 'PNG', x, yPos, size, size);
      };

      const ensureSpace = (needed) => {
        if (y + needed <= pageHeight - 18) return;
        doc.addPage();
        addWatermark();
        y = 18;
      };

      addWatermark();

      doc.setFontSize(20);
      doc.setFont(undefined, 'bold');
      doc.text('HR Metrics Summary', 14, y);
      
      y += 10;
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.text(`Generated: ${new Date().toLocaleDateString('en-ZM')} ${new Date().toLocaleTimeString()}`, 14, y);
      
      y += 12;
      doc.line(14, y, pageWidth - 14, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const introText = doc.splitTextToSize(
        'This self-service summary records the HR metrics calculated in this online tool. It is not a full HR analytics report and does not include benchmarking, root-cause analysis, or recommendations.',
        pageWidth - 28
      );
      doc.text(introText, 14, y);
      y += introText.length * 5 + 8;

      savedCalculations.forEach((item, index) => {
        ensureSpace(42);
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(`${index + 1}. ${item.name}`, 14, y);
        y += 7;

        doc.setFontSize(16);
        doc.text(item.value, 14, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont(undefined, 'normal');
        doc.text(item.category, 14, y);
        y += 5;

        const meaningText = doc.splitTextToSize(item.meaning, pageWidth - 28);
        ensureSpace(meaningText.length * 5 + 18);
        doc.text(meaningText, 14, y);
        y += meaningText.length * 5 + 3;

        doc.setFont(undefined, 'bold');
        doc.text('Formula:', 14, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const formulaText = doc.splitTextToSize(item.formula, pageWidth - 28);
        doc.text(formulaText, 14, y);
        y += formulaText.length * 5 + 4;

        const inputText = doc.splitTextToSize(
          `Inputs: ${item.inputs.map((input) => `${input.label}: ${input.value}`).join('; ')}`,
          pageWidth - 28
        );
        ensureSpace(inputText.length * 5 + 10);
        doc.setFontSize(8);
        doc.setFont(undefined, 'normal');
        doc.text(inputText, 14, y);
        y += inputText.length * 4 + 8;
      });

      ensureSpace(42);
      doc.line(14, y, pageWidth - 14, y);
      y += 8;
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('Need the full HR metrics report?', 14, y);
      
      y += 6;
      doc.setFontSize(9);
      doc.setFont(undefined, 'normal');
      const contactText = doc.splitTextToSize(
        'Contact us for benchmarking, trend analysis, risk interpretation, recommendations, and a management-ready HR analytics report tailored to your organization.',
        pageWidth - 28
      );
      doc.text(contactText, 14, y);
      
      y += contactText.length * 4 + 5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(9);
      doc.text('WhatsApp: +260 972 289 789', 14, y);
      y += 5;
      doc.text('Website: www.bmas.co.za', 14, y);

      doc.save(`HR-Metrics-Summary-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Unable to generate PDF. Please try again.');
    }
  });
})();
