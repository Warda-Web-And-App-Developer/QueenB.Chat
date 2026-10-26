/* QUEENBEE — miniapps.js : tiny apps inside a chat — collaborative notes, code snippets (with colours), expense splitting. (Polls live in chat.js.) */
(function () {
  'use strict';
  const N = window.Nova, { S, B, $, $$, esc, el, ic, toast, modal } = N;
  const curChat = () => S.chats.find(c => c.id === S.activeId);
  const nameOf = uid => (S.users[uid] || {}).username || 'Someone';
  const fmtMoney = (n, cur) => (cur || '') + (Math.round(n * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

  N.miniMenu = () => [
    { icon: 'note', text: 'Collaborative note', fn: () => noteModal() },
    { icon: 'code', text: 'Code snippet', fn: codeModal },
    { icon: 'calc', text: 'Split expenses', fn: expenseModal }
  ];

  /* ---------------- collaborative note ---------------- */
  function noteModal(msg) {
    const edit = !!msg, n = msg ? msg.note : { title: '', text: '' };
    const md = modal(`<form class="p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">${edit ? 'Edit shared note' : 'New shared note'}</h3><button type="button" class="icon-btn" data-x>${ic('x')}</button></div>
      <p class="text-xs text-[var(--muted)]">${edit ? 'Everyone in this chat sees your changes right away.' : 'Anyone in this chat can edit it afterwards.'}</p>
      <input id="nTitle" class="field" maxlength="60" placeholder="Title" value="${esc(n.title)}"><textarea id="nText" rows="9" class="field !rounded-2xl resize-y" placeholder="Write something… use “- ” for list items, “[ ] ” for tasks" maxlength="4000">${esc(n.text)}</textarea>
      <button class="btn btn-gold w-full">${ic('check', 'w-5 h-5')} ${edit ? 'Save changes' : 'Share note'}</button></form>`);
    $('[data-x]', md.box).onclick = md.close; setTimeout(() => $('#nTitle', md.box).focus(), 60);
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const title = $('#nTitle', md.box).value.trim(), text = $('#nText', md.box).value;
      if (!title && !text.trim()) return toast('Write something first');
      try {
        if (edit) await B.updateMessage(S.activeId, msg.id, { note: { title, text, by: S.me.uid, at: Date.now(), rev: (n.rev || 1) + 1 } });
        else await B.sendMessage(S.activeId, { from: S.me.uid, type: 'note', note: { title, text, by: S.me.uid, at: Date.now(), rev: 1 } });
        md.close();
      } catch (er) { toast(N.friendly(er)); }
    };
  }
  const noteLines = text => String(text || '').split('\n').slice(0, 12).map(l => {
    const t = /^\s*\[( |x)\]\s*(.*)$/i.exec(l);
    if (t) return `<div class="flex gap-1.5 items-start"><span class="mt-0.5">${t[1].toLowerCase() === 'x' ? '☑' : '☐'}</span><span>${esc(t[2])}</span></div>`;
    if (/^\s*[-*]\s+/.test(l)) return `<div class="flex gap-1.5"><span>•</span><span>${esc(l.replace(/^\s*[-*]\s+/, ''))}</span></div>`;
    return `<div>${esc(l) || '&nbsp;'}</div>`;
  }).join('');

  /* ---------------- code snippet + tiny syntax highlighter ---------------- */
  const LANGS = { javascript: 'JavaScript', python: 'Python', html: 'HTML', css: 'CSS', json: 'JSON', sql: 'SQL', bash: 'Shell', java: 'Java', cpp: 'C / C++', php: 'PHP', text: 'Plain text' };
  const KW = {
    javascript: 'const let var function return if else for while do switch case break continue new class extends import export from default async await try catch finally throw typeof instanceof this null undefined true false of in yield static super',
    python: 'def return if elif else for while in not and or is import from as class try except finally raise with lambda None True False pass break continue yield async await global self print',
    java: 'public private protected static final class interface extends implements void int long double float boolean char new return if else for while switch case break continue try catch finally throw throws import package null true false this super String',
    cpp: 'int long double float bool char void auto const static class struct public private protected return if else for while switch case break continue new delete namespace using include template typename nullptr true false this std',
    php: 'function return if else elseif foreach for while echo class public private protected static new null true false use namespace try catch finally throw as array isset',
    sql: 'select from where insert into values update set delete create table alter drop join left right inner outer on group by order having limit as and or not null primary key distinct union count sum avg min max like in between is',
    bash: 'if then else fi for do done while case esac function echo cd ls cat grep export sudo git npm node python pip',
    css: '', html: '', json: 'true false null'
  };
  function highlight(code, lang) {
    if (lang === 'text' || !LANGS[lang]) return esc(code);
    const kws = new Set((KW[lang] || '').split(' ').filter(Boolean)), ci = lang === 'sql';
    let re;
    if (lang === 'html') re = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w-]*)|("[^"]*"|'[^']*')|([\w-]+(?==))|(\/?>)/g;
    else if (lang === 'css') re = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(#[0-9a-fA-F]{3,8}\b|-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|s|ms)?)|([\w-]+(?=\s*:))|([.#][\w-]+)/g;
    else re = new RegExp((lang === 'python' || lang === 'bash' ? '(#.*)' : lang === 'sql' ? '(--.*)' : '(\\/\\/.*|\\/\\*[\\s\\S]*?\\*\\/)') + '|("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'|`(?:\\\\.|[^`\\\\])*`)|(\\b\\d+(?:\\.\\d+)?\\b)|(\\b[A-Za-z_$][\\w$]*\\b)(?=\\s*\\()|(\\b[A-Za-z_$][\\w$]*\\b)', 'g');
    let out = '', last = 0, m;
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index)); last = re.lastIndex; const t = m[0];
      let cls = '';
      if (lang === 'html') cls = m[1] ? 'c' : m[2] ? 'k' : m[3] ? 's' : m[4] ? 'f' : 'k';
      else if (lang === 'css') cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : m[4] ? 'f' : 'k';
      else if (m[1]) cls = 'c'; else if (m[2]) cls = 's'; else if (m[3]) cls = 'n';
      else if (m[4]) cls = kws.has(ci ? t.toLowerCase() : t) ? 'k' : 'f';
      else if (m[5]) cls = kws.has(ci ? t.toLowerCase() : t) ? 'k' : '';
      out += cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t);
    }
    return out + esc(code.slice(last));
  }
  function codeModal() {
    const md = modal(`<form class="p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">Share code</h3><button type="button" class="icon-btn" data-x>${ic('x')}</button></div>
      <select id="cLang" class="field !py-2 text-sm">${Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <textarea id="cText" rows="9" spellcheck="false" class="field !rounded-2xl font-mono text-[13px] resize-y" placeholder="Paste or type your code…" maxlength="6000"></textarea>
      <div class="code-prev hidden"></div>
      <button class="btn btn-gold w-full">${ic('send', 'w-5 h-5')} Send snippet</button></form>`);
    $('[data-x]', md.box).onclick = md.close; setTimeout(() => $('#cText', md.box).focus(), 60);
    const ta = $('#cText', md.box);
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; } };
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const text = ta.value.replace(/\s+$/, ''); if (!text.trim()) return toast('Add some code first');
      try { await B.sendMessage(S.activeId, { from: S.me.uid, type: 'code', code: { lang: $('#cLang', md.box).value, text } }); md.close(); } catch (er) { toast(N.friendly(er)); }
    };
  }

  /* ---------------- expense split ---------------- */
  function expenseModal() {
    const c = curChat(); if (!c) return; const people = c.members.map(u => S.users[u]).filter(Boolean);
    const md = modal(`<form class="p-5 space-y-3"><div class="flex items-center justify-between"><h3 class="text-lg font-bold">Split an expense</h3><button type="button" class="icon-btn" data-x>${ic('x')}</button></div>
      <input id="eTitle" class="field" maxlength="50" placeholder="What was it for? (e.g. Dinner)">
      <div class="flex gap-2"><input id="eCur" class="field !w-20 text-center" maxlength="4" value="Rs " aria-label="Currency"><input id="eAmt" class="field flex-1" type="number" inputmode="decimal" min="0" step="0.01" placeholder="Total amount"></div>
      <label class="block text-sm font-semibold">Paid by<select id="ePaid" class="field !py-2 mt-1 text-sm">${people.map(u => `<option value="${esc(u.uid)}" ${u.uid === S.me.uid ? 'selected' : ''}>${esc(u.username)}${u.uid === S.me.uid ? ' (you)' : ''}</option>`).join('')}</select></label>
      <div><div class="text-sm font-semibold mb-1">Split equally between</div><div id="eWho" class="max-h-40 overflow-y-auto space-y-1">${people.map(u => `<label class="flex items-center gap-2 py-1"><input type="checkbox" class="w-4 h-4 accent-[#C19552]" value="${esc(u.uid)}" checked><img class="w-7 h-7 rounded-full object-cover" src="${esc(N.avatar(u))}"><span>${esc(u.username)}</span></label>`).join('')}</div></div>
      <div id="ePrev" class="text-sm rounded-2xl bg-[var(--panel2)] px-3 py-2 text-[var(--muted)]">Each person pays —</div>
      <button class="btn btn-gold w-full">${ic('send', 'w-5 h-5')} Send split</button></form>`);
    $('[data-x]', md.box).onclick = md.close; setTimeout(() => $('#eTitle', md.box).focus(), 60);
    const prev = () => { const amt = +$('#eAmt', md.box).value, n = $$('#eWho input:checked', md.box).length; $('#ePrev', md.box).textContent = amt > 0 && n ? 'Each person pays ' + fmtMoney(amt / n, $('#eCur', md.box).value) : 'Each person pays —'; };
    ['input', 'change'].forEach(ev => md.box.addEventListener(ev, prev));
    md.box.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const title = $('#eTitle', md.box).value.trim() || 'Expense', total = +$('#eAmt', md.box).value, members = $$('#eWho input:checked', md.box).map(i => i.value);
      if (!(total > 0)) return toast('Enter the total amount'); if (members.length < 2 && !(members.length === 1 && members[0] !== $('#ePaid', md.box).value)) return toast('Choose at least two people to split between');
      try { await B.sendMessage(S.activeId, { from: S.me.uid, type: 'expense', expense: { title, total, cur: $('#eCur', md.box).value, paidBy: $('#ePaid', md.box).value, members, settled: {} } }); md.close(); } catch (er) { toast(N.friendly(er)); }
    };
  }
  function expenseBody(m) {
    const x = m.expense, share = x.total / x.members.length, owe = x.members.filter(u => u !== x.paidBy), settled = x.settled || {}, left = owe.filter(u => !settled[u]);
    return `<div class="w-[250px] sm:w-[290px]"><div class="font-bold flex gap-1.5 items-center">${ic('calc', 'w-4 h-4 shrink-0')}<span class="truncate">${esc(x.title)}</span></div>
      <div class="text-2xl font-extrabold mt-1">${fmtMoney(x.total, x.cur)}</div><div class="text-xs opacity-80 mb-2">Paid by ${esc(nameOf(x.paidBy))} · ${fmtMoney(share, x.cur)} each · ${x.members.length} people</div>
      <div class="space-y-1.5">${owe.length ? owe.map(u => `<div class="flex items-center justify-between gap-2 text-sm rounded-xl px-2.5 py-1.5 bg-onyx/10 dark:bg-snow/10"><span class="truncate">${esc(nameOf(u))} → ${esc(nameOf(x.paidBy))}</span><button class="exp-pay ${settled[u] ? 'on' : ''}" data-exp-pay="${esc(u)}">${settled[u] ? '✓ Paid' : fmtMoney(share, x.cur)}</button></div>`).join('') : '<div class="text-sm opacity-80">Nothing to settle.</div>'}</div>
      <div class="text-[11px] opacity-80 mt-2">${owe.length ? (left.length ? left.length + ' still to settle · tap an amount when it’s paid' : 'All settled 🎉') : ''}</div></div>`;
  }

  /* ---------------- rendering + clicks (called from chat.js) ---------------- */
  N.miniBody = function (m, q) {
    if (m.deleted) return '<div class="italic opacity-75">This message was deleted</div>';
    if (m.type === 'note' && m.note) {
      const n = m.note; return `<div class="w-[250px] sm:w-[300px]"><div class="font-bold flex gap-1.5 items-center">${ic('note', 'w-4 h-4 shrink-0')}<span class="truncate">${esc(n.title || 'Shared note')}</span></div><div class="text-sm mt-1.5 space-y-0.5 note-body">${noteLines(n.text)}</div>
        <div class="flex items-center justify-between gap-2 mt-2 text-[11px] opacity-80"><span>Edited by ${esc(nameOf(n.by))} · v${n.rev || 1}</span><button class="note-edit" data-note-edit>${ic('edit', 'w-3 h-3')} Edit</button></div></div>`;
    }
    if (m.type === 'code' && m.code) {
      const c = m.code; return `<div class="w-[260px] sm:w-[340px] max-w-full"><div class="flex items-center justify-between text-[11px] mb-1 opacity-80"><span class="font-bold uppercase tracking-wide">${esc(LANGS[c.lang] || 'Code')}</span><button class="note-edit" data-code-copy>${ic('copy', 'w-3 h-3')} Copy</button></div><pre class="code-block"><code>${highlight(c.text, c.lang)}</code></pre></div>`;
    }
    if (m.type === 'expense' && m.expense) return expenseBody(m);
    return '';
  };
  N.miniClick = function (e, id) {
    const m = S.msgs.find(x => x.id === id); if (!m) return false;
    if (e.target.closest('[data-note-edit]')) { noteModal(m); return true; }
    if (e.target.closest('[data-code-copy]')) { N.copy(m.code.text).then(() => toast('Code copied')); return true; }
    const pay = e.target.closest('[data-exp-pay]');
    if (pay) { const u = pay.dataset.expPay, x = m.expense; if (S.me.uid !== u && S.me.uid !== x.paidBy) { toast('Only ' + nameOf(u) + ' or ' + nameOf(x.paidBy) + ' can mark this as paid'); return true; } const settled = Object.assign({}, x.settled || {}); settled[u] = !settled[u]; B.updateMessage(S.activeId, id, { expense: Object.assign({}, x, { settled }) }).catch(er => toast(N.friendly(er))); return true; }
    return false;
  };
})();
