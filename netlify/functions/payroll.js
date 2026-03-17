function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}

function asMoney(value) {
  const num = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100) / 100;
}

// Zambia payroll ruleset (configured for 2026 in the user's reference implementation).
// IMPORTANT: Statutory rates/bands can change; treat as estimates unless verified for the current tax year.
const TAX_BRACKETS = [
  { upTo: 5100, rate: 0.0 },
  { upTo: 7100, rate: 0.2 },
  { upTo: 9200, rate: 0.3 },
  { upTo: Infinity, rate: 0.37 },
];

const DISABILITY_TAX_CREDIT_MONTHLY = 600;
const SDL_RATE_EMPLOYER = 0.005; // Skills Development Levy (employer only)
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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});

  if (event.httpMethod === 'GET') {
    return json(200, {
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
        sdl: 'employer-only levy on gross emoluments (rate configured)',
      },
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  // Back-compat: existing frontend sends { grossPay, allowances }.
  // Prefer the clearer field names when provided.
  const basicPay = asMoney(payload.basicPay ?? payload.grossPay);
  const taxableAllowances = asMoney(payload.taxableAllowances ?? payload.allowances ?? 0);
  const nonTaxableAllowances = asMoney(payload.nonTaxableAllowances ?? 0);
  const otherDeductions = asMoney(payload.otherDeductions ?? 0);

  if (basicPay === null || basicPay < 0) return json(400, { ok: false, error: 'basicPay must be a number >= 0' });
  if (taxableAllowances === null || taxableAllowances < 0) {
    return json(400, { ok: false, error: 'taxableAllowances must be a number >= 0' });
  }
  if (nonTaxableAllowances === null || nonTaxableAllowances < 0) {
    return json(400, { ok: false, error: 'nonTaxableAllowances must be a number >= 0' });
  }
  if (otherDeductions === null || otherDeductions < 0) {
    return json(400, { ok: false, error: 'otherDeductions must be a number >= 0' });
  }

  const currency = payload.currency || 'ZMW';

  const taxableIncome = asMoney(basicPay + taxableAllowances);
  const grossEmoluments = asMoney(taxableIncome + nonTaxableAllowances);

  // PAYE
  const disabilityCredit = payload.disabilityCredit ? DISABILITY_TAX_CREDIT_MONTHLY : 0;
  const rawPaye = asMoney(computePaye(taxableIncome));
  const paye = asMoney(Math.max(0, rawPaye - disabilityCredit));

  // NAPSA (employee + employer, each 5% capped)
  const napsaBase = Math.min(taxableIncome, NAPSA_CAP);
  const napsaEmployee = asMoney(napsaBase * NAPSA_RATE);
  const napsaEmployer = asMoney(napsaBase * NAPSA_RATE);

  // NHIMA (employee + employer, each 1% of basic pay)
  const nhimaEmployee = asMoney(basicPay * NHIMA_RATE);
  const nhimaEmployer = asMoney(basicPay * NHIMA_RATE);

  // Employer-only: Skills Development Levy (SDL) on gross emoluments.
  const sdlEmployer = asMoney(grossEmoluments * SDL_RATE_EMPLOYER);

  const statutoryDeductionsEmployee = asMoney(napsaEmployee + nhimaEmployee);
  const statutoryDeductionsEmployer = asMoney(napsaEmployer + nhimaEmployer + sdlEmployer);

  const totalDeductions = asMoney(otherDeductions + statutoryDeductionsEmployee + paye);
  const netPay = asMoney(grossEmoluments - totalDeductions);
  const employerCost = asMoney(grossEmoluments + statutoryDeductionsEmployer);

  return json(200, {
    ok: true,
    inputs: { basicPay, taxableAllowances, nonTaxableAllowances, otherDeductions, currency },
    results: {
      basicPay,
      taxableIncome,
      grossEmoluments,
      statutoryDeductions: statutoryDeductionsEmployee,
      estimatedTax: paye,
      totalDeductions,
      netPay,
      breakdown: {
        paye: {
          calculated: rawPaye,
          disabilityCreditApplied: asMoney(disabilityCredit),
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
    disclaimer:
      'Estimate only. Verify PAYE bands and statutory contribution rules for the applicable tax year before using for payroll decisions.',
  });
};
