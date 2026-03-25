/**
 * Reading comprehension passages and questions.
 *
 * Each passage has `text`, `source`, and `questions[]`.
 * Sources reference California Food & Agricultural Code sections.
 * To add a passage: append an object with the same shape.
 */

export const readPassages = [
  {
    text: 'Agricultural inspectors shall inspect all incoming shipments of nursery stock at the point of first arrival within the county. The inspector must verify that a valid phytosanitary certificate accompanies each shipment. If the certificate is missing or expired, the shipment shall be held at the point of arrival until a valid certificate is obtained or the shipment is returned to its point of origin. Inspectors may, at their discretion, draw random samples for laboratory analysis even when documentation is in order. Under no circumstances shall an inspector release a held shipment without supervisor approval.',
    source: 'Based on Cal. Food & Agr. Code \u00a76301\u20136306 (Nursery Stock Inspection)',
    questions: [
      { q: 'When must nursery stock be inspected?',                         correct: 'At the point of first arrival within the county',                                    wrong: ['Within 48 hours of delivery', 'After it reaches the retail location', 'Only when requested by the buyer'],     explanation: '"Shall inspect...at the point of first arrival."' },
      { q: 'If a phytosanitary certificate is expired, what happens?',      correct: 'It shall be held until a valid certificate is obtained or the shipment is returned',   wrong: ['Released with a warning', 'Immediately destroyed', 'Inspector issues a temporary permit'],                  explanation: '"Shall be held" \u2014 mandatory hold, no discretion.' },
      { q: 'Random sampling for lab analysis is:',                          correct: 'Optional, at the inspector\u2019s discretion, even when paperwork is valid',            wrong: ['Required for every shipment', 'Only done when docs are missing', 'Not permitted without court order'],       explanation: '"May, at their discretion" \u2014 permissive.' },
      { q: 'Who can authorize releasing a held shipment?',                  correct: 'A supervisor',                                                                          wrong: ['The inspector who placed the hold', 'The shipper', 'Any licensed inspector'],                               explanation: '"Under no circumstances...without supervisor approval."' },
    ]
  },
  {
    text: 'When conducting a pest detection survey, the inspector should place traps at intervals not exceeding one-quarter mile apart along the survey route. Each trap must be labeled with the date of placement, the inspector\u2019s identification number, and GPS coordinates. Traps must be checked at least every 14 calendar days. If a target pest is detected, the inspector shall immediately notify the County Agricultural Commissioner and must not remove the trap until directed to do so. Non-target organisms found in traps should be recorded on the survey log but do not require immediate notification.',
    source: 'Based on Cal. Code Regs. tit. 3, \u00a73280\u20133290 (Pest Detection Programs)',
    questions: [
      { q: 'What is the maximum spacing between traps?',       correct: 'One-quarter mile',                                                                    wrong: ['One mile', 'One-half mile', '500 feet'],                                          explanation: '"Not exceeding one-quarter mile apart."' },
      { q: 'How often must traps be checked at minimum?',       correct: 'Every 14 calendar days',                                                              wrong: ['Every 7 days', 'Every 30 days', 'Weekly on business days only'],                  explanation: '"At least every 14 calendar days."' },
      { q: 'What must happen if a target pest is found?',       correct: 'Immediately notify the County Agricultural Commissioner and leave the trap in place',  wrong: ['Remove trap and send specimen to lab', 'Record and continue', 'Call state entomologist in 48 hrs'], explanation: '"Shall immediately notify" + "must not remove."' },
      { q: 'Non-target organisms require what action?',         correct: 'Record on the survey log; no immediate notification required',                         wrong: ['Immediate notification to Commissioner', 'Disposal and trap replacement', 'Lab analysis in 7 days'], explanation: '"Should be recorded" but "do not require immediate notification."' },
    ]
  },
  {
    text: 'The Agricultural Commissioner\u2019s office shall maintain a registry of all certified farmers\u2019 markets operating within the county. Market operators must submit an application for certification no fewer than 30 days before the first day of operation. The application must include proof of liability insurance, a site plan showing vendor stall locations, and written verification from the local health department. Certified producers selling at the market are required to display a valid Certified Producer\u2019s Certificate (CPC) at all times during market hours. Inspectors may conduct unannounced compliance checks and shall revoke a vendor\u2019s market privileges if the CPC has been expired for more than 30 days.',
    source: 'Based on Cal. Food & Agr. Code \u00a747020\u201347025 (Direct Marketing / Certified Farmers\u2019 Markets)',
    questions: [
      { q: 'How far in advance must a market operator apply?',              correct: 'No fewer than 30 days before the first day of operation',    wrong: ['60 days', '14 days', '90 days'],                                                                    explanation: '"No fewer than 30 days before."' },
      { q: 'Which is NOT required in the application?',                     correct: 'A pest management plan',                                     wrong: ['Proof of liability insurance', 'A site plan showing stall locations', 'Verification from health dept'], explanation: 'Passage lists insurance, site plan, and health dept. only.' },
      { q: 'When must a CPC be displayed?',                                 correct: 'At all times during market hours',                            wrong: ['Only when inspector requests', 'First day of each season', 'Only for produce over $500'],              explanation: '"At all times during market hours."' },
      { q: 'When shall an inspector revoke market privileges?',             correct: 'If the CPC has been expired for more than 30 days',           wrong: ['If expired by one day', 'Only after formal hearing', 'Only with prior violations'],                  explanation: '"Shall revoke...if expired for more than 30 days."' },
    ]
  },
  {
    text: 'Pesticide use enforcement inspectors must complete a minimum of 40 hours of continuing education every two calendar years to maintain their authorization. At least 10 of those hours must cover laws and regulations, and at least 8 hours must address safety and environmental protection. The remaining hours may be fulfilled through approved conferences, online courses, or supervised field training. Inspectors who fail to meet the continuing education requirement by December 31 of the second year shall have their enforcement authorization suspended until the requirement is fulfilled. Suspended inspectors may not conduct independent field inspections but may accompany an authorized inspector for training purposes.',
    source: 'Based on Cal. Food & Agr. Code \u00a72281 (Continuing Education Requirements)',
    questions: [
      { q: 'How many total CE hours are required per two-year period?',     correct: '40 hours',                                                    wrong: ['20 hours', '30 hours', '50 hours'],                                               explanation: '"Minimum of 40 hours every two calendar years."' },
      { q: 'How many hours must cover laws and regulations?',               correct: 'At least 10 hours',                                           wrong: ['At least 8 hours', 'At least 15 hours', 'At least 20 hours'],                     explanation: '"At least 10 of those hours."' },
      { q: 'What happens if requirements are not met by deadline?',         correct: 'Their enforcement authorization is suspended until fulfilled', wrong: ['Written warning', 'Permanently decertified', 'Must retake licensing exam'],       explanation: '"Shall have their authorization suspended."' },
      { q: 'What can a suspended inspector do?',                            correct: 'Accompany an authorized inspector for training purposes',     wrong: ['Conduct inspections under supervision', 'Nothing \u2014 administrative leave', 'Issue citations only'], explanation: '"May accompany an authorized inspector for training."' },
    ]
  },
];
