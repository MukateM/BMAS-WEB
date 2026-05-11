function buildCorsHeaders(origin) {
  const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://bmas.vercel.app',
  ]);

  const envOrigins = [
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '',
  ].filter(Boolean);

  envOrigins.forEach((value) => allowedOrigins.add(value));

  const headers = {
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  };

  if (origin && allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers.vary = 'Origin';
  }

  return headers;
}

function sendJson(res, statusCode, body, origin) {
  const headers = buildCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.status(statusCode).json(body);
}

function asMoney(value) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

const TAX_BRACKETS = [
  { upTo: 5100, rate: 0.0 },
  { upTo: 7100, rate: 0.2 },
  { upTo: 9200, rate: 0.3 },
  { upTo: Infinity, rate: 0.37 },
];

const DISABILITY_TAX_CREDIT_MONTHLY = 600;
const SDL_RATE_EMPLOYER = 0.005;
const NAPSA_RATE = 0.05;
const NAPSA_CAP = 37236;
const NHIMA_RATE = 0.01;

function computePaye(taxableIncome) {
  let remaining = taxableIncome;
  let paye = 0;
  let lower = 0;

  for (const bracket of TAX_BRACKETS) {
    const bandAmount = Math.max(0, Math.min(remaining, bracket.upTo - lower));
    paye += bandAmount * bracket.rate;
    remaining -= bandAmount;
    lower = bracket.upTo;
    if (remaining <= 0) break;
  }

  return paye;
}

function normalizeAllowanceRates(allowanceRates) {
  const housingRate = Number(allowanceRates?.housingRate ?? 0.3);
  const transportRate = Number(allowanceRates?.transportRate ?? 0.1);
  const lunchRate = Number(allowanceRates?.lunchRate ?? 0.1);
  return {
    housingRate,
    transportRate,
    lunchRate,
    totalRate: housingRate + transportRate + lunchRate,
  };
}

function validateAllowanceRates(allowanceRates) {
  if (!allowanceRates) return { ok: true };
  if (typeof allowanceRates !== 'object' || Array.isArray(allowanceRates)) {
    return { ok: false, error: 'allowanceRates must be an object.' };
  }

  for (const [key, value] of Object.entries(allowanceRates)) {
    const numericValue = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(numericValue) || numericValue < 0 || numericValue > 2) {
      return { ok: false, error: `${key} must be a finite number between 0 and 2.` };
    }
  }

  return { ok: true };
}

function deriveFromGrossPay(grossPay, allowanceRates) {
  const rates = normalizeAllowanceRates(allowanceRates);
  const factor = 1 + rates.totalRate;
  const basicPay = asMoney(grossPay / factor);
  const taxableAllowances = asMoney(grossPay - basicPay);
  return {
    basicPay,
    taxableAllowances,
    rates,
    allowancesBreakdown: {
      housing: asMoney(basicPay * rates.housingRate),
      transport: asMoney(basicPay * rates.transportRate),
      lunch: asMoney(basicPay * rates.lunchRate),
      total: taxableAllowances,
    },
  };
}

function computePayroll({
  basicPay,
  taxableAllowances,
  nonTaxableAllowances,
  otherDeductions,
  currency,
  disabilityCredit,
  includeSdl,
}) {
  const taxableIncome = asMoney(basicPay + taxableAllowances);
  const grossEmoluments = asMoney(taxableIncome + nonTaxableAllowances);
  const disabilityCreditAmount = disabilityCredit ? DISABILITY_TAX_CREDIT_MONTHLY : 0;
  const rawPaye = asMoney(computePaye(taxableIncome));
  const paye = asMoney(Math.max(0, rawPaye - disabilityCreditAmount));
  const napsaBase = Math.min(taxableIncome, NAPSA_CAP);
  const napsaEmployee = asMoney(napsaBase * NAPSA_RATE);
  const napsaEmployer = asMoney(napsaBase * NAPSA_RATE);
  const nhimaEmployee = asMoney(basicPay * NHIMA_RATE);
  const nhimaEmployer = asMoney(basicPay * NHIMA_RATE);
  const sdlEmployer = includeSdl ? asMoney(grossEmoluments * SDL_RATE_EMPLOYER) : asMoney(0);
  const statutoryDeductionsEmployee = asMoney(napsaEmployee + nhimaEmployee);
  const statutoryDeductionsEmployer = asMoney(napsaEmployer + nhimaEmployer + sdlEmployer);
  const totalDeductions = asMoney(otherDeductions + statutoryDeductionsEmployee + paye);
  const netPay = asMoney(grossEmoluments - totalDeductions);
  const employerCost = asMoney(grossEmoluments + statutoryDeductionsEmployer);

  return {
    inputs: { basicPay, taxableAllowances, nonTaxableAllowances, otherDeductions, currency },
    results: {
      basicPay,
      taxableAllowances,
      nonTaxableAllowances,
      taxableIncome,
      grossEmoluments,
      statutoryDeductions: statutoryDeductionsEmployee,
      estimatedTax: paye,
      totalDeductions,
      netPay,
      breakdown: {
        allowances: null,
        paye: {
          calculated: rawPaye,
          disabilityCreditApplied: asMoney(disabilityCreditAmount),
          payable: paye,
        },
        napsa: { base: asMoney(napsaBase), employee: napsaEmployee, employer: napsaEmployer },
        nhima: { base: basicPay, employee: nhimaEmployee, employer: nhimaEmployer },
        employer: {
          sdl: sdlEmployer,
          statutoryContributions: statutoryDeductionsEmployer,
          estimatedTotalCost: employerCost,
        },
      },
      currency,
    },
  };
}

function solveBasicFromTargetNet({
  targetNet,
  allowanceRates,
  nonTaxableAllowances,
  otherDeductions,
  currency,
  disabilityCredit,
  includeSdl,
}) {
  const rates = normalizeAllowanceRates(allowanceRates);
  const allowanceFactor = 1 + rates.totalRate;

  function netFromBasic(basicPay) {
    const taxableAllowances = asMoney(basicPay * (allowanceFactor - 1));
    const computed = computePayroll({
      basicPay,
      taxableAllowances,
      nonTaxableAllowances,
      otherDeductions,
      currency,
      disabilityCredit,
      includeSdl,
    });
    return computed.results.netPay;
  }

  let low = 0;
  let high = Math.max(1000, targetNet * 2);

  for (let i = 0; i < 30; i++) {
    const netHigh = netFromBasic(high);
    if (netHigh >= targetNet) break;
    high *= 1.5;
  }

  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    const netMid = netFromBasic(mid);
    if (Math.abs(netMid - targetNet) <= 0.01) return asMoney(mid);
    if (netMid > targetNet) high = mid;
    else low = mid;
  }

  return asMoney(high);
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';

  if (req.method === 'OPTIONS') {
    const headers = buildCorsHeaders(origin);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(
      res,
      200,
      {
        ok: true,
        calculator: 'BMAS Payroll Calculator',
        version: '0.3.0',
        note:
          'This endpoint provides an estimate based on configured Zambia payroll rules. Verify bands/rates for the current tax year before using for payroll decisions.',
        assumptions: {
          payPeriod: 'monthly',
          taxableIncome: 'basicPay + taxableAllowances',
          nhimaBase: 'basicPay (employee 1% + employer 1%)',
          napsaBase: `min(taxableIncome, ${NAPSA_CAP}) (employee 5% + employer 5%)`,
          sdl: 'optional employer-only levy on gross emoluments (disabled by default)',
        },
        modes: {
          gross: 'Gross (basic + standard taxable allowances) -> net',
          reverse: 'Target net -> estimated gross (standard taxable allowances)',
          forward: 'Legacy: basic + taxable allowances -> net',
        },
      },
      origin,
    );
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' }, origin);
    return;
  }

  const payloadLength = typeof req.body === 'string' ? req.body.length : JSON.stringify(req.body || {}).length;
  if (payloadLength > 10000) {
    sendJson(res, 413, { ok: false, error: 'Payload too large' }, origin);
    return;
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid JSON body' }, origin);
    return;
  }
  const basicPay = asMoney(payload.basicPay ?? (payload.mode === 'gross' ? null : payload.grossPay));
  const taxableAllowances = asMoney(payload.taxableAllowances ?? payload.allowances ?? 0);
  const grossPay = asMoney(payload.grossPay);
  const nonTaxableAllowances = asMoney(payload.nonTaxableAllowances ?? 0);
  const otherDeductions = asMoney(payload.otherDeductions ?? 0);
  const mode = payload.mode === 'reverse' ? 'reverse' : payload.mode === 'gross' ? 'gross' : 'forward';

  if (mode === 'gross') {
    if (grossPay === null || grossPay < 0) {
      sendJson(res, 400, { ok: false, error: 'grossPay must be a number >= 0' }, origin);
      return;
    }
  } else if (mode === 'forward') {
    if (basicPay === null || basicPay < 0) {
      sendJson(res, 400, { ok: false, error: 'basicPay must be a number >= 0' }, origin);
      return;
    }
    if (taxableAllowances === null || taxableAllowances < 0) {
      sendJson(res, 400, { ok: false, error: 'taxableAllowances must be a number >= 0' }, origin);
      return;
    }
  }

  if (nonTaxableAllowances === null || nonTaxableAllowances < 0) {
    sendJson(res, 400, { ok: false, error: 'nonTaxableAllowances must be a number >= 0' }, origin);
    return;
  }
  if (otherDeductions === null || otherDeductions < 0) {
    sendJson(res, 400, { ok: false, error: 'otherDeductions must be a number >= 0' }, origin);
    return;
  }

  const currency = payload.currency || 'ZMW';
  const disabilityCredit = Boolean(payload.disabilityCredit);
  const includeSdl = Boolean(payload.includeSdl);
  let computedBasicPay = basicPay;
  let computedTaxableAllowances = taxableAllowances;
  const allowanceRates = payload.allowanceRates || payload.standardAllowances || null;
  const allowanceRatesValidation = validateAllowanceRates(allowanceRates);
  if (!allowanceRatesValidation.ok) {
    sendJson(res, 400, { ok: false, error: allowanceRatesValidation.error }, origin);
    return;
  }
  let allowancesBreakdown = null;
  let grossPayStandard = null;

  if (mode === 'reverse') {
    const targetNet = asMoney(payload.targetNet);
    if (targetNet === null || targetNet < 0) {
      sendJson(res, 400, { ok: false, error: 'targetNet must be a number >= 0' }, origin);
      return;
    }

    computedBasicPay = solveBasicFromTargetNet({
      targetNet,
      allowanceRates,
      nonTaxableAllowances,
      otherDeductions,
      currency,
      disabilityCredit,
      includeSdl,
    });

    const rates = normalizeAllowanceRates(allowanceRates);
    computedTaxableAllowances = asMoney(computedBasicPay * rates.totalRate);
    grossPayStandard = asMoney(computedBasicPay + computedTaxableAllowances);
    allowancesBreakdown = deriveFromGrossPay(grossPayStandard, allowanceRates).allowancesBreakdown;
  }

  if (mode === 'gross') {
    const derived = deriveFromGrossPay(grossPay, allowanceRates);
    computedBasicPay = derived.basicPay;
    computedTaxableAllowances = derived.taxableAllowances;
    grossPayStandard = asMoney(grossPay);
    allowancesBreakdown = derived.allowancesBreakdown;
  }

  const { inputs, results } = computePayroll({
    basicPay: computedBasicPay,
    taxableAllowances: computedTaxableAllowances,
    nonTaxableAllowances,
    otherDeductions,
    currency,
    disabilityCredit,
    includeSdl,
  });

  results.breakdown.allowances = allowancesBreakdown;
  if (grossPayStandard !== null) results.grossPayStandard = grossPayStandard;

  sendJson(
    res,
    200,
    {
      ok: true,
      mode,
      inputs,
      results,
      disclaimer:
        'Estimate only. Verify PAYE bands and statutory contribution rules for the applicable tax year before using for payroll decisions.',
    },
    origin,
  );
}
