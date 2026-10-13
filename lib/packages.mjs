/** Ready-to-send package copy. Recipients stay empty. No invented addresses. */

export const STARTERS = [
  {
    name: 'Investor - Friends & Family',
    kind: 'investor',
    emailSubject: 'Friends and family - $25,000 for 5%',
    emailBody: [
      'Hello {{first_name}},',
      '',
      'I am opening a friends-and-family round for 4orm Finance. The ask is $25,000 for 5%.',
      '',
      'This note is ready to send after we talk. The docs that ship with it are the files in the Drive folder on this package.',
      '',
      'Thank you,',
      'Chad',
    ].join('\n'),
    research: 'Suggested names to add from Contacts, with no address filled in: Kevin, Bruce, Dean, BJ, Daryl.',
    suggestions: [
      { name: 'Kevin', role: '' },
      { name: 'Bruce', role: '' },
      { name: 'Dean', role: '' },
      { name: 'BJ', role: '' },
      { name: 'Daryl', role: '' },
    ],
  },
  {
    name: 'Data Room',
    kind: 'data_room',
    emailSubject: '4orm Finance data room',
    emailBody: [
      'Hello {{first_name}},',
      '',
      'The data room for {{company}} is the Drive folder on this package. Those files are the set that ships with this note.',
      '',
      'I can walk through them on a call and send this right after.',
      '',
      'Chad',
    ].join('\n'),
    research: '',
    suggestions: [],
  },
  {
    name: 'Design partner - Brokerages',
    kind: 'partner',
    emailSubject: 'Design partner - brokerage discovery',
    emailBody: [
      'Hello {{first_name}},',
      '',
      'I would like {{company}} to look at 4orm Finance as a design partner. Century 21 and Remax desks are the first conversations.',
      '',
      'What this recipient cares about: a short discovery on how a brokerage desk would use the product, what a pilot week looks like, and who on the desk would try it.',
      '',
      'Chad',
    ].join('\n'),
    research: 'Century 21 and Remax discovery. What the desk cares about: how a brokerage would use the product, what a pilot week looks like, and who on the desk would try it.',
    suggestions: [],
  },
  {
    name: 'Regulator - RPAA note',
    kind: 'regulator',
    emailSubject: 'RPAA note - independent review',
    emailBody: [
      'Hello {{first_name}},',
      '',
      'I am sending the RPAA note and the supporting docs from the Drive folder.',
      '',
      'Research for this note:',
      '- RPAA registration and the independent-review point.',
      '- FINTRAC suitability and the evidence we can show.',
      '- What counsel should pressure-test before this goes further. Michael Stephens at Fasken is the suggested recipient.',
      '',
      'Happy to walk through it right after a call.',
      '',
      'Chad',
    ].join('\n'),
    research: 'RPAA registration and the independent-review point. FINTRAC suitability and the evidence we can show. Michael Stephens at Fasken is the suggested recipient. No address is filled in.',
    suggestions: [{ name: 'Michael Stephens', role: 'Fasken' }],
  },
];

export function fillToken(body, recipient) {
  const name = String(recipient?.name || '').trim();
  const first = name.split(/\s+/)[0] || '';
  const company = String(recipient?.company || '');
  return String(body || '').replaceAll('{{first_name}}', first).replaceAll('{{company}}', company);
}

export function assembleMail(pkg, recipient) {
  let body = fillToken(pkg.emailBody || pkg.email_body || '', recipient);
  const research = String(pkg.research || '').trim();
  const kind = pkg.kind || '';
  if ((kind === 'regulator' || kind === 'partner') && research && !body.includes(research)) {
    body = `${body}\n\n${research}`;
  }
  const docs = Array.isArray(pkg.docs) ? pkg.docs : [];
  const lines = docs
    .map((doc) => {
      const name = String(doc.name || 'Doc');
      const url = String(doc.url || '');
      return url ? `${name} - ${url}` : name;
    })
    .filter(Boolean);
  if (lines.length) body = `${body}\n\nDocs:\n${lines.join('\n')}`;
  return body;
}
