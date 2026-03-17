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
      version: '0.2.0',
      note:
        'This endpoint provides an estimate based on configured Zambia payroll rules. Verify bands/rates for the current tax year before using for payroll decisions.',
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let payload;
  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON body' });
  }

  const grossPay = asMoney(payload.grossPay);
  const allowances = asMoney(payload.allowances ?? 0);
  const otherDeductions = asMoney(payload.otherDeductions ?? 0);

  if (grossPay === null || grossPay < 0) return json(400, { ok: false, error: 'grossPay must be a number >= 0' });
  if (allowances === null || allowances < 0) return json(400, { ok: false, error: 'allowances must be a number >= 0' });
  if (otherDeductions === null || otherDeductions < 0) {
    return json(400, { ok: false, error: 'otherDeductions must be a number >= 0' });
  }

  // Assumptions for this calculator:
  // - `grossPay` is the employee's basic pay
  // - `allowances` are additional taxable allowances
  // - NHIMA is calculated on basic pay (not allowances)
  const basicPay = asMoney(grossPay);
  const taxableIncome = asMoney(grossPay + allowances);

  const paye = asMoney(computePaye(taxableIncome));
  const napsaBase = Math.min(taxableIncome, NAPSA_CAP);
  const napsa = asMoney(napsaBase * NAPSA_RATE);
  const nhima = asMoney(basicPay * NHIMA_RATE);

  const statutoryDeductions = asMoney(napsa + nhima);
  const estimatedTax = asMoney(paye);
  const totalDeductions = asMoney(otherDeductions + statutoryDeductions + estimatedTax);
  const netPay = asMoney(taxableIncome - totalDeductions);

  return json(200, {
    ok: true,
    inputs: { grossPay, allowances, otherDeductions },
    results: {
      basicPay,
      taxableIncome,
      statutoryDeductions,
      estimatedTax,
      totalDeductions,
      netPay,
      breakdown: {
        paye,
        napsa,
        nhima,
      },
      currency: payload.currency || 'ZMW',
    },
    disclaimer:
      'Estimate only. Verify PAYE bands and statutory contribution rules for the applicable tax year before using for payroll decisions.',
  });
};
