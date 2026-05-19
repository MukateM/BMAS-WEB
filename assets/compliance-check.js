const groups = [
  {
    title: 'Registration',
    questions: [
      {
        id: 'labour-commissioner',
        text: 'Registered as an employer with the Labour Commissioner?',
        issue: 'Employer registration may be incomplete.',
        action: 'Confirm employer registration records and update them before inspection.',
      },
      {
        id: 'napsa-registration',
        text: 'Registered with NAPSA?',
        issue: 'NAPSA employer registration may be missing.',
        action: 'Register the employer and align payroll remittances with NAPSA requirements.',
      },
      {
        id: 'workers-compensation',
        text: 'Registered with Workers Compensation Fund Control Board?',
        issue: 'Workers compensation cover may be missing.',
        action: 'Confirm WCFCB registration and keep proof available for inspections.',
      },
      {
        id: 'tax-clearance',
        text: 'Valid TPIN and tax clearance?',
        issue: 'Tax registration or clearance records may not be current.',
        action: 'Review TPIN and tax clearance status with ZRA requirements.',
      },
    ],
  },
  {
    title: 'Contracts and Employment Records',
    questions: [
      {
        id: 'written-contracts',
        text: 'Written contracts for all employees?',
        issue: 'Some employees may not have written employment contracts.',
        action: 'Prepare written contracts for all staff and keep signed copies.',
      },
      {
        id: 'attested-contracts',
        text: 'Employment contracts attested by the Labour Commissioner?',
        issue: 'Contract attestation may be incomplete.',
        action: 'Identify contracts needing attestation and prepare them for submission.',
      },
      {
        id: 'itemised-payslips',
        text: 'Itemised payslips issued?',
        issue: 'Employees may not be receiving itemised pay records.',
        action: 'Issue payslips showing earnings, statutory deductions, and net pay.',
      },
      {
        id: 'service-certificates',
        text: 'Certificates of service given on separation?',
        issue: 'Separation documentation may be incomplete.',
        action: 'Add certificate of service issuance to the exit process.',
      },
      {
        id: 'employee-records',
        text: 'Accurate employee records kept, including contracts, leave forms, and next-of-kin details?',
        issue: 'Employee record keeping may not support audit or dispute handling.',
        action: 'Create a secure employee file checklist and close missing records.',
      },
    ],
  },
  {
    title: 'Minimum Wage and Job Categories',
    helper: 'Use not applicable if you do not employ that category. Confirm final rates against the current wage order before making payroll decisions.',
    allowNa: true,
    questions: [
      {
        id: 'domestic-worker-wage',
        text: 'Domestic worker pay checked against the current minimum wage order, including transport where applicable?',
        issue: 'Domestic worker pay may not have been checked against the current minimum wage order.',
        action: 'Review domestic worker pay and allowances against the applicable wage order.',
      },
      {
        id: 'domestic-worker-attested',
        text: 'Domestic worker contract attested?',
        issue: 'Domestic worker contract attestation may be missing.',
        action: 'Prepare the contract for attestation if the category applies.',
      },
      {
        id: 'general-worker-wage',
        text: 'General worker pay checked against the current basic pay and allowance requirements?',
        issue: 'General worker pay may not have been checked against current basic pay and allowance requirements.',
        action: 'Review basic pay and allowances against the applicable wage order.',
      },
      {
        id: 'general-worker-attested',
        text: 'General worker contract attested?',
        issue: 'General worker contract attestation may be missing.',
        action: 'Prepare the contract for attestation if the category applies.',
      },
      {
        id: 'bus-driver-wage',
        text: 'Bus driver pay checked against the current minimum wage order?',
        issue: 'Bus driver pay may not have been checked against the current minimum wage order.',
        action: 'Review driver pay against the applicable wage order.',
      },
      {
        id: 'bus-driver-attested',
        text: 'Bus driver contract attested?',
        issue: 'Bus driver contract attestation may be missing.',
        action: 'Prepare the contract for attestation if the category applies.',
      },
      {
        id: 'truck-driver-wage',
        text: 'Truck driver pay checked against the current minimum wage order?',
        issue: 'Truck driver pay may not have been checked against the current minimum wage order.',
        action: 'Review driver pay against the applicable wage order.',
      },
      {
        id: 'truck-driver-attested',
        text: 'Truck driver contract attested?',
        issue: 'Truck driver contract attestation may be missing.',
        action: 'Prepare the contract for attestation if the category applies.',
      },
    ],
  },
  {
    title: 'Payroll Remittances',
    questions: [
      {
        id: 'napsa-remittance',
        text: 'Remit NAPSA monthly?',
        issue: 'Monthly NAPSA contributions may not be remitted.',
        action: 'Reconcile payroll against NAPSA schedules and clear any arrears.',
      },
      {
        id: 'paye-remittance',
        text: 'Remit PAYE to ZRA?',
        issue: 'PAYE remittance may be missing or delayed.',
        action: 'Review PAYE deductions, filing, and payment records.',
      },
      {
        id: 'nhima-remittance',
        text: 'Remit NHIMA contributions?',
        issue: 'NHIMA contributions may not be remitted.',
        action: 'Reconcile payroll deductions and employer obligations for NHIMA.',
      },
    ],
  },
  {
    title: 'HR Policies and Practitioner Support',
    questions: [
      {
        id: 'disciplinary-code',
        text: 'Written disciplinary code?',
        issue: 'Disciplinary process may be undocumented.',
        action: 'Adopt a written disciplinary code and communicate it to employees.',
      },
      {
        id: 'employment-policies',
        text: 'Documented employment policies for leave, conduct, and related matters?',
        issue: 'Employment policies may be missing or informal.',
        action: 'Document core HR policies and align them with statutory requirements.',
      },
      {
        id: 'registered-practitioner',
        text: 'Registered HR practitioner handling staff matters?',
        issue: 'Staff matters may be handled without certified HR support.',
        action: 'Assign a certified practitioner or outsource HR compliance support to BMAS.',
      },
    ],
  },
  {
    title: 'Staff Welfare and Fair Process',
    questions: [
      {
        id: 'union-membership',
        text: 'Allow trade union membership?',
        issue: 'Freedom of association may be restricted.',
        action: 'Review workplace rules and employee communications on union membership.',
      },
      {
        id: 'safe-workplace',
        text: 'Safe working environment?',
        issue: 'Workplace safety controls may be insufficient.',
        action: 'Document safety checks, incidents, and corrective actions.',
      },
      {
        id: 'statutory-leave',
        text: 'Provide statutory leave, including annual, sick, and maternity leave?',
        issue: 'Leave entitlements may not be fully provided or recorded.',
        action: 'Audit leave policies and balances against statutory entitlements.',
      },
      {
        id: 'termination-hearing',
        text: 'Give employees a hearing before termination?',
        issue: 'Termination processes may lack procedural fairness.',
        action: 'Use a documented hearing process before disciplinary termination decisions.',
      },
    ],
  },
];

const bandContent = {
  red: {
    label: 'High Risk',
    color: '#dc2626',
    badgeClass: 'bg-rose-100 text-rose-800',
    summary: 'Your answers show significant compliance exposure. A structured review should happen urgently.',
  },
  amber: {
    label: 'Medium Risk',
    color: '#d97706',
    badgeClass: 'bg-amber-100 text-amber-800',
    summary: 'You have some important compliance foundations, but several gaps could create inspection or dispute risk.',
  },
  blue: {
    label: 'Moderate Risk',
    color: '#0284c7',
    badgeClass: 'bg-sky-100 text-sky-800',
    summary: 'You are moving in the right direction. Close the remaining gaps before they become costly.',
  },
  green: {
    label: 'Strong Position',
    color: '#059669',
    badgeClass: 'bg-emerald-100 text-emerald-800',
    summary: 'Your score is strong. BMAS can still help maintain compliance through certified HR support or outsourced administration.',
  },
};

const questionGroups = document.getElementById('questionGroups');
const form = document.getElementById('complianceForm');
const clearBtn = document.getElementById('clearCompliance');
const statusEl = document.getElementById('assessmentStatus');
const meter = document.getElementById('scoreMeter');
const scoreValue = document.getElementById('scoreValue');
const riskBadge = document.getElementById('riskBadge');
const riskSummary = document.getElementById('riskSummary');
const scoreBreakdown = document.getElementById('scoreBreakdown');
const riskActions = document.getElementById('riskActions');
const riskList = document.getElementById('riskList');
const contactResult = document.getElementById('contactResult');
const resultScoreField = document.getElementById('resultScoreField');
const resultBandField = document.getElementById('resultBandField');
const resultGapsField = document.getElementById('resultGapsField');
const resultAnswersField = document.getElementById('resultAnswersField');
const downloadReportBtn = document.getElementById('downloadComplianceReport');
const leadForm = document.getElementById('complianceContactForm');
const leadSubmitStatus = document.getElementById('leadSubmitStatus');
const leadSubmitButton = document.getElementById('leadSubmitButton');
const recaptchaSiteKey = document.querySelector('meta[name="bmas-recaptcha-site-key"]')?.content?.trim() || '';
let lastResult = null;
let recaptchaLoadPromise = null;

const criticalQuestions = new Set([
  'labour-commissioner',
  'napsa-registration',
  'workers-compensation',
  'written-contracts',
  'napsa-remittance',
  'paye-remittance',
  'nhima-remittance',
  'safe-workplace',
  'termination-hearing',
]);

const importantQuestions = new Set([
  'tax-clearance',
  'attested-contracts',
  'itemised-payslips',
  'employee-records',
  'domestic-worker-wage',
  'domestic-worker-attested',
  'general-worker-wage',
  'general-worker-attested',
  'bus-driver-wage',
  'bus-driver-attested',
  'truck-driver-wage',
  'truck-driver-attested',
  'statutory-leave',
]);

const exposureByGroup = {
  Registration: 'Inspection teams may require registration proof and current statutory records.',
  'Contracts and Employment Records': 'Missing records can weaken audit readiness and employment dispute defence.',
  'Minimum Wage and Job Categories': 'Wage gaps can trigger arrears, corrective orders, or worker claims after review.',
  'Payroll Remittances': 'Late or missing remittances can attract statutory penalties, interest, arrears, and enforcement action.',
  'HR Policies and Practitioner Support': 'Informal HR handling can increase disciplinary, leave, and grievance risk.',
  'Staff Welfare and Fair Process': 'Safety, leave, union, and termination gaps can create high dispute and enforcement exposure.',
};

function allQuestions() {
  return groups.flatMap((group) =>
    group.questions.map((question) => ({ ...question, group: group.title, allowNa: Boolean(group.allowNa) })),
  );
}

function getQuestionWeight(question) {
  if (criticalQuestions.has(question.id)) return 3;
  if (importantQuestions.has(question.id)) return 2;
  return 1;
}

function getSeverity(question) {
  const weight = getQuestionWeight(question);
  if (weight >= 3) return 'Critical';
  if (weight === 2) return 'Important';
  return 'Advisory';
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function renderQuestions() {
  if (!questionGroups) return;
  questionGroups.textContent = '';

  groups.forEach((group) => {
    const section = createEl('section', 'rounded-lg border bg-slate-50 p-4');
    const heading = createEl('h3', 'font-semibold text-slate-900', group.title);
    section.appendChild(heading);

    if (group.helper) {
      section.appendChild(createEl('p', 'mt-1 text-xs text-slate-500', group.helper));
    }

    const list = createEl('div', 'mt-4 space-y-3');
    group.questions.forEach((question) => {
      const fieldset = createEl('fieldset', 'compliance-question rounded border bg-white p-4');
      const legend = createEl('legend', 'px-1 text-sm font-medium text-slate-900', question.text);
      fieldset.appendChild(legend);

      const options = createEl('div', 'compliance-options mt-3 flex flex-wrap gap-3');
      [
        ['yes', 'Yes'],
        ['no', 'No'],
        ...(group.allowNa ? [['na', 'Not applicable']] : []),
      ].forEach(([value, label]) => {
        const optionLabel = createEl('label', 'compliance-option inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-slate-700 hover:bg-slate-50');
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = question.id;
        input.value = value;
        input.required = !group.allowNa;
        input.className = 'border-slate-300';
        optionLabel.appendChild(input);
        optionLabel.appendChild(document.createTextNode(label));
        options.appendChild(optionLabel);
      });

      fieldset.appendChild(options);
      list.appendChild(fieldset);
    });

    section.appendChild(list);
    questionGroups.appendChild(section);
  });
}

function getBand(score) {
  if (score < 50) return 'red';
  if (score <= 70) return 'amber';
  if (score > 90) return 'green';
  return 'blue';
}

function setBadgeClass(band) {
  riskBadge.className = `rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${bandContent[band].badgeClass}`;
}

function renderRiskList(failures) {
  riskList.textContent = '';
  if (failures.length === 0) {
    const empty = createEl('div', 'rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900');
    empty.textContent = 'No gaps were flagged from your applicable answers. Keep records current and consider periodic HR compliance reviews.';
    riskList.appendChild(empty);
    return;
  }

  failures.forEach((failure) => {
    const card = createEl('article', 'rounded border bg-white p-4');
    const top = createEl('div', 'text-xs font-semibold uppercase tracking-[0.16em] text-slate-500', `${failure.group} - ${getSeverity(failure)}`);
    const title = createEl('h4', 'mt-1 font-semibold text-slate-900', failure.issue);
    const action = createEl('p', 'mt-2 text-sm text-slate-600', failure.action);
    const penalty = createEl(
      'p',
      'mt-2 text-xs text-amber-800',
      exposureByGroup[failure.group] || 'Possible exposure depends on the facts and the applicable statutory framework.',
    );
    card.appendChild(top);
    card.appendChild(title);
    card.appendChild(action);
    card.appendChild(penalty);
    riskList.appendChild(card);
  });
}

function calculateResult() {
  const questions = allQuestions();
  let applicable = 0;
  let yes = 0;
  let applicableWeight = 0;
  let yesWeight = 0;
  const failures = [];
  const missing = [];
  const answers = [];

  questions.forEach((question) => {
    const selected = form.querySelector(`input[name="${question.id}"]:checked`);
    if (!selected) {
      if (question.allowNa) {
        answers.push({
          group: question.group,
          question: question.text,
          answer: 'na',
          weight: getQuestionWeight(question),
        });
        return;
      }
      missing.push(question);
      return;
    }
    answers.push({
      group: question.group,
      question: question.text,
      answer: selected.value,
      weight: getQuestionWeight(question),
    });
    if (selected.value === 'na') return;
    applicable += 1;
    applicableWeight += getQuestionWeight(question);
    if (selected.value === 'yes') {
      yes += 1;
      yesWeight += getQuestionWeight(question);
    } else {
      failures.push(question);
    }
  });

  return { applicable, yes, applicableWeight, yesWeight, failures, missing, answers };
}

function formatAnswersForLead(answers) {
  return answers
    .map((answer) => `${answer.group}: ${answer.question} = ${answer.answer.toUpperCase()} (weight ${answer.weight})`)
    .join(' | ');
}

function updateHiddenFields(score, bandLabel, failures, answers) {
  resultScoreField.value = `${score}%`;
  resultBandField.value = bandLabel;
  resultGapsField.value = failures.length
    ? failures.map((failure) => `${failure.group}: ${failure.issue}`).join(' | ')
    : 'No applicable gaps flagged';
  resultAnswersField.value = formatAnswersForLead(answers);
}

function scrollToResults() {
  document.getElementById('resultPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildReportHtml(result) {
  const failuresHtml = result.failures.length
    ? result.failures
        .map(
          (failure, index) => `
            <section class="item">
              <div class="meta">${index + 1}. ${escapeHtml(getSeverity(failure))} - ${escapeHtml(failure.group)}</div>
              <h2>${escapeHtml(failure.issue)}</h2>
              <p><strong>Recommended action:</strong> ${escapeHtml(failure.action)}</p>
              <p><strong>Possible exposure:</strong> ${escapeHtml(exposureByGroup[failure.group] || 'Depends on facts and applicable law.')}</p>
            </section>
          `,
        )
        .join('')
    : '<section class="item success"><h2>No applicable gaps flagged</h2><p>Keep records current and consider periodic HR compliance reviews.</p></section>';

  const answersHtml = result.answers
    .map(
      (answer) => `
        <tr>
          <td>${escapeHtml(answer.group)}</td>
          <td>${escapeHtml(answer.question)}</td>
          <td>${escapeHtml(answer.answer.toUpperCase())}</td>
        </tr>
      `,
    )
    .join('');

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>BMAS Compliance Check Report</title>
        <style>
          @page { margin: 18mm; }
          body { color: #0f172a; font-family: Arial, sans-serif; line-height: 1.45; }
          .watermark {
            height: 430px;
            left: 50%;
            opacity: 0.24;
            position: fixed;
            top: 50%;
            transform: translate(-50%, -50%) rotate(-12deg);
            width: 420px;
            z-index: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .report-content {
            position: relative;
            z-index: 1;
          }
          header { border-bottom: 3px solid #f59e0b; margin-bottom: 22px; padding-bottom: 14px; }
          h1 { font-size: 24px; margin: 0; }
          h2 { font-size: 15px; margin: 4px 0 8px; }
          p { margin: 6px 0; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 18px 0; }
          .box { border: 1px solid #cbd5e1; padding: 10px; }
          .label, .meta { color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
          .value { font-size: 20px; font-weight: 800; margin-top: 3px; }
          .item { border: 1px solid #e2e8f0; margin: 10px 0; padding: 12px; break-inside: avoid; }
          .success { border-color: #a7f3d0; background: #ecfdf5; }
          table { border-collapse: collapse; font-size: 11px; margin-top: 14px; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; }
          th { background: #f8fafc; }
          footer { border-top: 1px solid #cbd5e1; color: #64748b; font-size: 11px; margin-top: 18px; padding-top: 10px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <img class="watermark" src="/bmas.png" alt="" />
        <div class="report-content">
          <header>
            <div class="label">Business Momentum Advisory Services</div>
            <h1>Employer Compliance Check Report</h1>
            <p>Generated ${escapeHtml(new Date().toLocaleString())}</p>
          </header>
          <section class="summary">
            <div class="box"><div class="label">Score</div><div class="value">${escapeHtml(result.score)}%</div></div>
            <div class="box"><div class="label">Risk Band</div><div class="value">${escapeHtml(result.bandLabel)}</div></div>
            <div class="box"><div class="label">Applicable</div><div class="value">${escapeHtml(result.applicable)}</div></div>
            <div class="box"><div class="label">Yes Answers</div><div class="value">${escapeHtml(result.yes)}</div></div>
          </section>
          <h2>Priority Areas</h2>
          ${failuresHtml}
          <h2>Submitted Answers</h2>
          <table>
            <thead><tr><th>Area</th><th>Question</th><th>Answer</th></tr></thead>
            <tbody>${answersHtml}</tbody>
          </table>
          <footer>
            This self-assessment is general guidance only and is not a formal audit or legal opinion. Minimum wage and statutory rules should be confirmed against current law before decisions are made.
          </footer>
        </div>
      </body>
    </html>`;
}

function savePdfReport(result) {
  const reportWindow = window.open('', '_blank');
  if (!reportWindow) {
    window.print();
    return;
  }
  reportWindow.document.open();
  reportWindow.document.write(buildReportHtml(result));
  reportWindow.document.close();
  window.setTimeout(() => {
    reportWindow.focus();
    reportWindow.print();
  }, 450);
}

function getInputValue(id) {
  return document.getElementById(id)?.value || '';
}

function loadRecaptcha() {
  if (!recaptchaSiteKey) return Promise.resolve(null);
  if (window.grecaptcha?.execute) return Promise.resolve(window.grecaptcha);
  if (recaptchaLoadPromise) return recaptchaLoadPromise;

  recaptchaLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.grecaptcha || null);
    script.onerror = () => reject(new Error('Unable to load reCAPTCHA.'));
    document.head.appendChild(script);
  });

  return recaptchaLoadPromise;
}

async function getRecaptchaToken() {
  const grecaptcha = await loadRecaptcha();
  if (!recaptchaSiteKey || !grecaptcha?.execute) return '';

  return new Promise((resolve, reject) => {
    grecaptcha.ready(() => {
      grecaptcha
        .execute(recaptchaSiteKey, { action: 'compliance_lead' })
        .then(resolve)
        .catch(() => reject(new Error('Unable to complete reCAPTCHA.')));
    });
  });
}

function setLeadStatus(message, tone = 'neutral') {
  if (!leadSubmitStatus) return;
  leadSubmitStatus.textContent = message;
  leadSubmitStatus.className = tone === 'error' ? 'text-sm text-rose-700' : tone === 'success' ? 'text-sm text-emerald-700' : 'text-sm text-slate-600';
}

renderQuestions();

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  const { applicable, yes, applicableWeight, yesWeight, failures, missing, answers } = calculateResult();

  if (missing.length > 0) {
    statusEl.textContent = 'Please answer all required questions before scoring.';
    form.reportValidity();
    return;
  }

  if (applicable === 0) {
    statusEl.textContent = 'At least one question must be applicable to calculate a score.';
    return;
  }

  const score = Math.round((yesWeight / applicableWeight) * 100);
  const band = getBand(score);
  const content = bandContent[band];

  meter.style.setProperty('--score', String(score));
  meter.style.setProperty('--meter-color', content.color);
  scoreValue.textContent = `${score}%`;
  riskBadge.textContent = content.label;
  setBadgeClass(band);
  riskSummary.textContent = content.summary;
  scoreBreakdown.textContent = `${yes} Yes answer${yes === 1 ? '' : 's'} out of ${applicable} applicable question${applicable === 1 ? '' : 's'}, weighted by compliance severity.`;
  riskActions.classList.remove('hidden');
  contactResult.classList.remove('hidden');
  renderRiskList(failures);
  updateHiddenFields(score, content.label, failures, answers);
  lastResult = {
    score,
    bandLabel: content.label,
    applicable,
    yes,
    failures,
    answers,
  };

  statusEl.textContent = 'Assessment scored.';
  scrollToResults();
});

downloadReportBtn?.addEventListener('click', () => {
  if (!lastResult) return;
  savePdfReport(lastResult);
});

leadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!lastResult) {
    setLeadStatus('Please complete the assessment first.', 'error');
    return;
  }

  if (!leadForm.reportValidity()) return;

  const payload = {
    gotcha: getInputValue('leadGotcha'),
    fullName: getInputValue('leadName'),
    email: getInputValue('leadEmail'),
    phone: getInputValue('leadPhone'),
    company: getInputValue('leadCompany'),
    message: getInputValue('leadMessage'),
    consent: Boolean(document.getElementById('leadConsent')?.checked),
    score: resultScoreField.value,
    band: resultBandField.value,
    gaps: resultGapsField.value,
    answers: resultAnswersField.value,
    recaptchaToken: await getRecaptchaToken(),
  };

  leadSubmitButton.disabled = true;
  setLeadStatus('Sending your assessment to BMAS...');

  try {
    const response = await fetch('/api/compliance-lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Unable to submit right now.');
    }
    leadForm.reset();
    setLeadStatus('Sent. BMAS will respond using the details provided.', 'success');
  } catch (error) {
    setLeadStatus(error.message || 'Unable to submit right now.', 'error');
  } finally {
    leadSubmitButton.disabled = false;
  }
});

clearBtn?.addEventListener('click', () => {
  form.reset();
  statusEl.textContent = '';
  meter.style.setProperty('--score', '0');
  meter.style.setProperty('--meter-color', '#94a3b8');
  scoreValue.textContent = '--';
  riskBadge.textContent = 'Pending';
  riskBadge.className = 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600';
  riskSummary.textContent = 'Complete the assessment to see your compliance risk.';
  scoreBreakdown.textContent = 'The meter calculates your Yes answers against applicable questions only.';
  riskActions.classList.add('hidden');
  contactResult.classList.add('hidden');
  riskList.textContent = '';
  lastResult = null;
});
