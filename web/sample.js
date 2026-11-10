export const agreement = `INDEPENDENT CONTRACTOR AGREEMENT
CP-2026-014 · Northstar Studio × Maya Chen

§2.1 Contractor compensation
Northstar Studio will pay Maya Chen USD 1,000.00 for the November design milestone, due 2026-11-12.

§3.2 Employer-funded benefit
Northstar Studio will pay Harbor Health USD 100.00 for Maya Chen's healthcare contribution, due 2026-11-12. This amount is paid in addition to contractor compensation.

SIGNED AMENDMENT A · 2026-11-10
§A.1 Revised benefits deadline
The due date in §3.2 moves to 2026-11-16. All other terms remain in effect.`;

export const sample = {
  name: 'Northstar Studio × Maya Chen', reference: 'CP-2026-014', concerns: [],
  obligations: [
    {kind:'worker', payee:'Maya Chen', cents:100000, due:'2026-11-12', evidence:'Northstar Studio will pay Maya Chen USD 1,000.00 for the November design milestone, due 2026-11-12.', amendment:''},
    {kind:'benefit', payee:'Harbor Health', cents:10000, due:'2026-11-16', evidence:"Northstar Studio will pay Harbor Health USD 100.00 for Maya Chen's healthcare contribution, due 2026-11-12. This amount is paid in addition to contractor compensation.", amendment:'The due date in §3.2 moves to 2026-11-16.'}
  ]
};
