// The 20 eval captures (eval/fixtures/README.md). Each problem is injected in the browser only:
// `steps` drives the real app, `css`/`inject` change the page, `mock` fails or hangs requests.
// Nothing here touches the apps' code. `mobile` is 390×844, desktop 1440×900.

// Clinic booking panel helpers, as a string the steps can include.
const MEDIC = `
  const btn = (pred) => [...document.querySelectorAll('.booking-panel button')].find(pred);
  const openPanel = async () => { document.querySelector('button.header-booking').click(); await sleep(1200); };
  const choose = async (name) => { btn((b) => b.classList.contains('choice-row') && b.textContent.includes(name)).click(); await sleep(1800); };
  const next = async () => { btn((b) => b.classList.contains('button-primary') && !b.textContent.includes('Nazad')).click(); await sleep(1000); };
  const set = (el, v) => { Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };
`;
const SET = `const set = (el, v) => { Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); };`;
const PIZ_FILL = `${SET} set(document.querySelector('#ime'), 'Ana Kovač'); set(document.querySelector('#firma'), 'Pekara Zrno'); set(document.querySelector('#telefon'), '061 000 000'); set(document.querySelector('#email'), 'ana@example.com'); set(document.querySelector('#poruka'), 'Imamo 12 zaposlenih i novu peć, treba nam procjena rizika.');`;
const NEXT_500 = `document.open(); document.write('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"><title>500: Internal Server Error</title></head><body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#000;background:#fff;height:100vh;display:flex;align-items:center;justify-content:center;text-align:center"><div><h1 style="display:inline-block;margin:0 20px 0 0;padding:0 23px 0 0;font-size:24px;font-weight:500;vertical-align:top;line-height:49px;border-right:1px solid rgba(0,0,0,.3)">500</h1><div style="display:inline-block"><h2 style="font-size:14px;font-weight:400;line-height:49px;margin:0">Internal Server Error.</h2></div></div></body></html>'); document.close();`;

export const cases = [
  // Visual bugs
  { id: '002', app: 'medic', mobile: true, category: 'visual', problem: 'The "Odaberi" button sits on top of the service description, cutting off the text under it.',
    url: '/', steps: `${MEDIC} await openPanel();`, inject: `for (const row of document.querySelectorAll('.booking-panel .choice-row')) { const el = [...row.querySelectorAll('*')].find((e) => e.children.length <= 1 && /^Odaberi/.test(e.textContent.trim())); const box = el?.closest('span, div') ?? el; if (box) { box.style.position = 'relative'; box.style.zIndex = '2'; box.style.marginTop = '-34px'; } }` },
  { id: '003', app: 'piz', mobile: false, category: 'visual', problem: 'The hero heading overlaps the paragraph under it.',
    url: '/', css: `main h1 { margin-bottom: -56px !important; position: relative; z-index: 5; }` },
  { id: '004', app: 'park', mobile: true, category: 'visual', problem: 'The room cards are squeezed into three columns on a phone, with prices and names wrapping into single letters.',
    url: '/sr', inject: `const card = [...document.querySelectorAll('a, article, li, div')].find((el) => el.children.length && /^SOBA\\s*Soba 1/.test(el.innerText.replace(/\\s+/g, ' ').trim())); const grid = card.parentElement; grid.style.display = 'grid'; grid.style.gridTemplateColumns = 'repeat(3, 1fr)'; grid.style.gap = '6px';`, focus: `[...document.querySelectorAll('*')].find((el) => el.children.length === 0 && el.textContent.trim() === 'Soba 1')` },
  { id: '005', app: 'piz', mobile: true, category: 'visual', problem: 'The hero photo is missing; a broken-image placeholder shows in its place.',
    url: '/', inject: `const img = [...document.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('poster-postrojenje-radnici')); img.removeAttribute('srcset'); img.src = '/slike/poster-postrojenje-radnici-v2.jpg'; img.style.minHeight = '220px'; img.style.background = '#e9e9e9';`, focus: `[...document.querySelectorAll('img')].find((i) => i.getAttribute('src')?.includes('poster-postrojenje-radnici'))` },
  { id: '006', app: 'dental', mobile: false, category: 'visual', problem: 'The day list is in pale grey text on white, unreadable.',
    url: '/', inject: `const times = [...document.querySelectorAll('body *')].filter((el) => el.children.length === 0 && /^[0-9]{2}:[0-9]{2}$/.test(el.textContent.trim())); if (times.length < 2) throw new Error('no time rows: ' + times.length); let box = times[0]; while (box && !box.contains(times[times.length - 1])) box = box.parentElement; box.id = 'pale-day-list'; const st = document.createElement('style'); st.textContent = '#pale-day-list, #pale-day-list * { color: #d4d4d4 !important; }'; document.head.appendChild(st);` },

  // Functional bugs
  { id: '007', app: 'park', mobile: false, category: 'functional', problem: 'A two-night stay at 55 BAM a night shows a total of 55 BAM.',
    url: '/admin/rezervacije', inject: `const row = [...document.querySelectorAll('tr')].find((tr) => tr.textContent.includes('Ana Kova')); const cell = [...row.querySelectorAll('td')].find((td) => td.textContent.trim() === '110 BAM'); cell.textContent = '55 BAM';` },
  { id: '008', app: 'medic', mobile: true, category: 'functional', problem: 'The slot step offers a Sunday, when the clinic is closed.',
    url: '/', steps: `${MEDIC} await openPanel(); await choose('Pedijatrija');`, inject: `const leaf = [...document.querySelectorAll('.booking-panel *')].filter((el) => el.children.length === 0); const h = leaf.find((el) => /^[A-ZČĆŠŽ][a-zčćšž]+, [0-9]{1,2}[.] [a-zčćšž]+$/.test(el.textContent.trim())); if (h) h.textContent = 'Nedjelja, 25. oktobar'; const days = [...document.querySelectorAll('.booking-panel button')].filter((b) => /^(Ned|Pon|Uto|Sri|Čet|Pet|Sub)[0-9]/.test(b.textContent.replace(/[^A-Za-z0-9ČĆŠŽčćšž]/g, ''))); for (const d of days) d.classList.remove('selected'); (days.find((b) => b.textContent.trim().startsWith('Ned')) ?? days[0]).classList.add('selected');` },
  { id: '009', app: 'dental', mobile: true, category: 'functional', problem: 'The first doctor\'s day list says "Nema termina." although the header counts 6 appointments.',
    url: '/', inject: `const head = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && /6 termina/.test(el.textContent)); const block = head.closest('section, li, div'); const rows = [...block.querySelectorAll('button')].filter((b) => /^\\d\\d:\\d\\d/.test(b.textContent.trim())); const first = rows[0]; const list = first?.parentElement; if (list) { for (const r of rows) r.remove(); const p = document.createElement('p'); p.className = 'px-1.5 py-1 text-[12px] text-ink-2'; p.textContent = 'Nema termina.'; list.appendChild(p); }`, focus: `[...document.querySelectorAll('*')].find((el) => el.children.length === 0 && /6 termina/.test(el.textContent))` },
  { id: '010', app: 'park', mobile: false, category: 'functional', problem: 'The same reservation appears twice in the list.',
    url: '/admin/rezervacije', inject: `const row = [...document.querySelectorAll('tbody tr')][0]; row.parentElement.insertBefore(row.cloneNode(true), row.nextSibling); const n = [...document.querySelectorAll('*')].find((el) => el.children.length === 0 && /Prikazano 8 od 8/.test(el.textContent)); if (n) n.textContent = 'Prikazano 9 od 9';` },
  { id: '011', app: 'dental', mobile: false, category: 'functional', problem: 'The "Slobodno" filter is selected but the list still shows every appointment.',
    url: '/', inject: `const pills = [...document.querySelectorAll('button[aria-pressed]')]; const all = pills.find((b) => b.textContent.trim() === 'Sve'); const free = pills.find((b) => b.textContent.startsWith('Slobodno')); const onClass = all.className; all.className = free.className; free.className = onClass; all.setAttribute('aria-pressed', 'false'); free.setAttribute('aria-pressed', 'true');` },

  // Error states
  { id: '012', app: 'park', mobile: true, category: 'error', problem: 'The rooms page answers with a 500 error page.',
    url: '/sr/sobe', inject: NEXT_500, skipScrub: true },
  { id: '013', app: 'piz', mobile: true, category: 'error', problem: 'Sending the contact form fails with a network error; the form shows the "cannot send" message.',
    url: '/kontakt', mock: { pattern: '*kontakt.php*', mode: 'fail' }, steps: `${PIZ_FILL} await sleep(300); document.querySelector('form').requestSubmit(); await sleep(2500);`, focus: `[...document.querySelectorAll('form *')].find((el) => el.children.length === 0 && /nije mogu[ćc]e poslati/.test(el.textContent)) ?? document.querySelector('form button[type=submit]')` },
  { id: '014', app: 'piz', mobile: true, category: 'error', problem: 'A correctly filled e-mail field shows "Unesite ispravnu e-mail adresu."',
    url: '/kontakt', steps: `${PIZ_FILL}`, inject: `const email = document.querySelector('#email'); email.setAttribute('aria-invalid', 'true'); email.style.borderColor = '#b42318'; const p = document.createElement('p'); p.className = 'mt-2 text-sm'; p.style.color = '#b42318'; p.textContent = 'Unesite ispravnu e-mail adresu.'; email.insertAdjacentElement('afterend', p);`, focus: `document.querySelector('#email')` },
  { id: '015', app: 'piz', mobile: false, category: 'error', problem: 'The contact form stays on "Slanje upita…" for ever; the request never completes.',
    url: '/kontakt', mock: { pattern: '*kontakt.php*', mode: 'hang' }, steps: `${PIZ_FILL} await sleep(300); document.querySelector('form').requestSubmit(); await sleep(6000);`, focus: `document.querySelector('form button[type=submit]')` },

  // User mistakes
  { id: '016', app: 'piz', mobile: false, category: 'mistake', problem: 'The contact form was sent with the required fields empty; the app shows its own validation message.',
    url: '/kontakt', steps: `document.querySelector('form').requestSubmit(); await sleep(800);`, focus: `document.querySelector('#ime')` },
  { id: '017', app: 'medic', mobile: true, category: 'mistake', problem: 'The phone number was typed as "abc 12"; the app refuses it.',
    url: '/', steps: `${MEDIC} await openPanel(); await choose('Pedijatrija'); btn((b) => b.textContent.trim() === '08:30').click(); await sleep(300); await next(); const f = document.querySelector('.booking-panel form'); set(f.querySelector('input[autocomplete=name]'), 'Ana Kovač'); set(f.querySelector('input[type=tel]'), 'abc 12'); const c = f.querySelector('input[type=checkbox]'); if (c && !c.checked) c.click(); await sleep(300); f.requestSubmit(); await sleep(1000); f.querySelector('input[type=tel]').scrollIntoView({ block: 'center' });` },
  { id: '018', app: 'park', mobile: true, category: 'mistake', problem: 'The departure date is before the arrival date; the app asks for a later departure.',
    url: '/sr/rezervacija?checkIn=2026-11-05&checkOut=2026-11-03&guestCount=1', steps: `[...document.querySelectorAll('button')].find((b) => b.textContent.includes('Provjerite dostupnost')).click(); await sleep(800); document.querySelector('[role=alert], .text-red-700, p[class*=red]')?.scrollIntoView({ block: 'center' });` },

  // Unclear: the screen looks normal
  { id: '019', app: 'dental', mobile: false, category: 'unclear', problem: 'Nothing is wrong on the screen (the 7-day schedule).', url: '/raspored' },
  { id: '020', app: 'park', mobile: false, category: 'unclear', problem: 'Nothing is wrong on the screen (the home page).', url: '/sr' },
  { id: '021', app: 'medic', mobile: false, category: 'unclear', problem: 'Nothing is wrong on the screen (the booking panel, service step).', url: '/', steps: `${MEDIC} await openPanel();`,
    // The page behind the panel has a staff photo and the brand mark; only the panel stays visible.
    css: 'body * { visibility: hidden !important; } .booking-panel, .booking-panel * { visibility: visible !important; }' },
];
