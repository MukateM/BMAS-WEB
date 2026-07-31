(function () {
  const money = (n, currency = 'ZMW') =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(n || 0));

  const form = document.getElementById('payrollForm');
  const statusEl = document.getElementById('status');
  const resultEl = document.getElementById('result');
  const targetNetWrap = document.getElementById('targetNetWrap');
  const targetNetEl = document.getElementById('targetNet');
  const grossPayEl = document.getElementById('grossPay');
  const grossPayWrap = document.getElementById('grossPayWrap');

  if (!form || !statusEl || !resultEl || !targetNetWrap || !targetNetEl || !grossPayEl || !grossPayWrap) {
    return;
  }

  function getMode() {
    return document.querySelector('input[name="calcMode"]:checked')?.value || 'gross';
  }

  function syncModeUi() {
    const mode = getMode();
    const isReverse = mode === 'reverse';

    targetNetWrap.classList.toggle('hidden', !isReverse);
    targetNetEl.toggleAttribute('required', isReverse);
    grossPayWrap.classList.toggle('hidden', isReverse);
    grossPayEl.toggleAttribute('required', !isReverse);
    grossPayEl.toggleAttribute('disabled', isReverse);
  }

  document.querySelectorAll('input[name="calcMode"]').forEach((el) => {
    el.addEventListener('change', () => {
      syncModeUi();
      statusEl.textContent = '';
      resultEl.classList.add('hidden');
    });
  });

  syncModeUi();

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      syncModeUi();
      resultEl.classList.add('hidden');
      statusEl.textContent = '';
    }, 0);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Calculating...';

    const grossPay = document.getElementById('grossPay')?.value || 0;
    const otherDeductions = document.getElementById('otherDeductions')?.value || 0;
    const nonTaxableAllowances = document.getElementById('nonTaxableAllowances')?.value || 0;
    const disabilityCredit = Boolean(document.getElementById('disabilityCredit')?.checked);
    const includeSdl = Boolean(document.getElementById('includeSdl')?.checked);
    const mode = getMode();
    const targetNet = targetNetEl.value || 0;

    if (mode === 'reverse' && !String(targetNetEl.value || '').trim()) {
      statusEl.textContent = 'Please enter a target net pay.';
      resultEl.classList.add('hidden');
      return;
    }

    async function postPayroll(url) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode,
          targetNet,
          grossPay,
          nonTaxableAllowances,
          disabilityCredit,
          includeSdl,
          otherDeductions,
          currency: 'ZMW',
          allowanceRates: { housingRate: 0.3, transportRate: 0.2, lunchRate: 0.1 },
        }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch {}

      return { res, data };
    }

    try {
      const result = await postPayroll('/api/payroll');
      if (!result.res.ok || !result.data?.ok) {
        const errMsg = result.data?.error || `Unable to calculate (HTTP ${result.res.status})`;
        throw new Error(
          result.res.status === 404
            ? 'Payroll API not available locally. Run the site through Vercel dev or deploy to Vercel to enable /api/payroll.'
            : errMsg,
        );
      }

      const r = result.data.results;
      document.getElementById('grossPayOut').textContent = money(r.grossPayStandard ?? r.grossEmoluments, r.currency);
      document.getElementById('grossEmolumentsOut').textContent = money(r.grossEmoluments, r.currency);
      document.getElementById('taxableIncome').textContent = money(r.taxableIncome, r.currency);
      document.getElementById('basicPayOut').textContent = money(r.basicPay, r.currency);
      document.getElementById('taxableAllowancesOut').textContent = money(r.taxableAllowances, r.currency);
      document.getElementById('netPay').textContent = money(r.netPay, r.currency);
      document.getElementById('estimatedTax').textContent = money(r.estimatedTax, r.currency);
      document.getElementById('statutoryDeductions').textContent = money(r.statutoryDeductions, r.currency);
      document.getElementById('napsaEmployee').textContent = money(r.breakdown?.napsa?.employee, r.currency);
      document.getElementById('nhimaEmployee').textContent = money(r.breakdown?.nhima?.employee, r.currency);
      document.getElementById('otherDeductionsOut').textContent = money(result.data.inputs.otherDeductions, r.currency);
      document.getElementById('totalDeductions').textContent = money(r.totalDeductions, r.currency);
      document.getElementById('employerCost').textContent = money(r.breakdown?.employer?.estimatedTotalCost, r.currency);

      resultEl.classList.remove('hidden');
      statusEl.textContent = result.data.disclaimer || '';
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      resultEl.classList.add('hidden');
    }
  });
})();
