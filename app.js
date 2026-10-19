'use strict';

const CFG = window.APP_CONFIG;
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const $ = (id) => document.getElementById(id);

// カード上部に専用表示する列。それ以外の列は「詳細」にすべて表示する。
const HEAD_COLS = ['名前', '読み方', '機関', '部署', '役職', 'きっかけ', '日付', '曜日', '写真リンク'];
// 詳細に表示しない列
const HIDDEN_COLS = ['#', '№', '住所(都道府県)'];
// 詳細での表示順（ここにない列は後ろにシートの順で並ぶ）
const DETAIL_ORDER = ['〒', '住所(都道府県)', '住所', '携帯', 'Tel', '内線', 'Fax', 'E-mail', '外見等'];

let rows = [];
let tokenClient = null;

const DEMO = [
  { '#': '1', 'きっかけ': '展示会', '日付': '2024/05/14', '曜日': '火', '名前': '山田 太郎', '読み方': 'やまだ たろう',
    '機関': '株式会社サンプル', '部署': '営業部', '役職': '部長', '〒': '100-0001', '住所(都道府県)': '東京都', '№': '13',
    '住所': '千代田区千代田1-1', '携帯': '090-1234-5678', 'Tel': '03-1234-5678', '内線': '123', 'Fax': '03-1234-5679',
    'E-mail': 'yamada@example.com', '外見等': '眼鏡、背が高い', '写真リンク': '' },
  { '#': '2', 'きっかけ': '学会', '日付': '2023/11/02', '曜日': '木', '名前': '佐藤 花子', '読み方': 'さとう はなこ',
    '機関': 'テスト大学', '部署': '工学部 情報学科', '役職': '准教授', '〒': '530-0001', '住所(都道府県)': '大阪府', '№': '27',
    '住所': '大阪市北区梅田1-1-1', '携帯': '070-2222-3333', 'Tel': '06-1111-2222', '内線': '4567', 'Fax': '',
    'E-mail': 'sato@example.ac.jp', '外見等': 'ショートヘア', '写真リンク': '' },
  { '#': '3', 'きっかけ': '紹介(鈴木さん)', '日付': '2025/02/20', '曜日': '木', '名前': 'ジョン スミス', '読み方': 'じょん すみす',
    '機関': 'Example Inc.', '部署': 'R&D', '役職': 'Manager', '〒': '', '住所(都道府県)': '神奈川県', '№': '14',
    '住所': '横浜市西区みなとみらい2-2', '携帯': '080-9999-0000', 'Tel': '', '内線': '', 'Fax': '',
    'E-mail': 'john@example.com', '外見等': '', '写真リンク': '' },
];

// ---------- 検索用の正規化（全角半角・大小文字・カタカナ/ひらがな・空白を吸収） ----------
function norm(s) {
  return String(s ?? '').normalize('NFKC').toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/g, '');
}

function parseDate(s) {
  const m = String(s || '').match(/(\d{4})\D(\d{1,2})\D(\d{1,2})/);
  return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : NaN;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Google Drive の共有リンクをサムネイルURLに変換
function photoUrl(link) {
  if (!link) return '';
  const m = link.match(/\/d\/([\w-]+)/) || link.match(/[?&]id=([\w-]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w200` : link;
}

function linkify(key, val) {
  const v = esc(val);
  if (!val) return '';
  if (['携帯', 'Tel'].includes(key)) return `<a href="tel:${esc(val.replace(/[^\d+]/g, ''))}">${v}</a>`;
  if (key === 'E-mail') return `<a href="mailto:${v}">${v}</a>`;
  if (/^https?:\/\//.test(val)) return `<a href="${v}" target="_blank" rel="noopener">${v}</a>`;
  return v;
}

// ---------- 描画 ----------
function cardHtml(r) {
  const addr = [r['住所(都道府県)'], r['住所']].filter(Boolean).join('');
  const photo = photoUrl(r['写真リンク']);
  const initial = esc((r['名前'] || '?').trim().charAt(0));
  const avatar = photo
    ? `<img class="avatar" src="${esc(photo)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=avatar>${initial}</div>'">`
    : `<div class="avatar">${initial}</div>`;

  const actions = [];
  if (r['Tel']) actions.push(`<a href="tel:${esc(r['Tel'].replace(/[^\d+]/g, ''))}">☎ Tel${r['内線'] ? ' (内' + esc(r['内線']) + ')' : ''}</a>`);
  if (r['携帯']) actions.push(`<a href="tel:${esc(r['携帯'].replace(/[^\d+]/g, ''))}">📱 携帯</a>`);
  if (r['E-mail']) actions.push(`<a href="mailto:${esc(r['E-mail'])}">✉ メール</a>`);
  if (addr) actions.push(`<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}" target="_blank" rel="noopener">📍 地図</a>`);

  const rank = (k) => (DETAIL_ORDER.includes(k) ? DETAIL_ORDER.indexOf(k) : DETAIL_ORDER.length);
  const details = Object.keys(r)
    .filter((k) => !k.startsWith('_') && !HEAD_COLS.includes(k) && !HIDDEN_COLS.includes(k) && r[k])
    .sort((a, b) => rank(a) - rank(b))
    .map((k) => `<dt>${esc(k)}</dt><dd>${linkify(k, r[k])}</dd>`).join('');
  const photoRow = r['写真リンク'] ? `<dt>写真</dt><dd>${linkify('', r['写真リンク'])}</dd>` : '';

  return `<article class="card">
    <div class="card-head">${avatar}
      <div>
        <div class="name">${esc(r['名前'])}</div>
        ${r['読み方'] ? `<div class="kana">${esc(r['読み方'])}</div>` : ''}
      </div>
    </div>
    <div class="org">${esc(r['機関'])} ${esc(r['部署'])} <span class="title">${esc(r['役職'])}</span></div>
    <div class="meta">
      ${r['日付'] ? `<span class="chip">📅 ${esc(r['日付'])}${r['曜日'] ? '(' + esc(r['曜日']) + ')' : ''}</span>` : ''}
      ${r['きっかけ'] ? `<span class="chip">🤝 ${esc(r['きっかけ'])}</span>` : ''}
    </div>
    ${actions.length ? `<div class="actions">${actions.join('')}</div>` : ''}
    ${details || photoRow ? `<details><summary>詳細</summary><dl>${details}${photoRow}</dl></details>` : ''}
  </article>`;
}

function render() {
  const terms = norm($('q').value) ? $('q').value.split(/\s+/).map(norm).filter(Boolean) : [];
  let list = rows.filter((r) => terms.every((t) => r._search.includes(t)));

  const sort = $('sort').value;
  const cmp = {
    'no': (a, b) => a._i - b._i,
    'date-desc': (a, b) => (b._date || 0) - (a._date || 0),
    'date-asc': (a, b) => (a._date || Infinity) - (b._date || Infinity),
    'kana': (a, b) => (a['読み方'] || '').localeCompare(b['読み方'] || '', 'ja'),
    'org': (a, b) => (a['機関'] || '').localeCompare(b['機関'] || '', 'ja'),
  }[sort];
  list = list.slice().sort(cmp);

  $('list').innerHTML = list.map(cardHtml).join('');
  $('count').textContent = `${list.length} / ${rows.length} 件`;
  $('msg').textContent = rows.length && !list.length ? '該当する名刺はありません' : '';
}

function setRows(objs) {
  rows = objs.filter((r) => r['名前'] || r['機関']).map((r, i) => ({
    ...r, _i: i, _date: parseDate(r['日付']),
    _search: norm(Object.values(r).join(' ')),
  }));
  render();
}

// ---------- Google ログイン & Sheets 取得 ----------
async function fetchSheet(token) {
  $('msg').textContent = '読み込み中…';
  const range = encodeURIComponent(CFG.SHEET_NAME);
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${CFG.SPREADSHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $('msg').textContent = `読み込みに失敗しました (${res.status}) ${err.error?.message || ''}`;
    return;
  }
  const { values = [] } = await res.json();
  const [header = [], ...body] = values;
  setRows(body.map((row) => Object.fromEntries(header.map((h, i) => [String(h).trim(), row[i] ?? '']))));
  $('signin').hidden = true;
  $('reload').hidden = false;
}

window.onGisLoad = function () {
  if (!CFG.CLIENT_ID) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.CLIENT_ID, scope: SCOPE,
    callback: (resp) => resp.access_token ? fetchSheet(resp.access_token) : ($('msg').textContent = 'ログインできませんでした'),
  });
  $('signin').hidden = false;
  $('msg').textContent = '「Googleでログイン」を押してください';
};

$('signin').onclick = $('reload').onclick = () => tokenClient && tokenClient.requestAccessToken({ prompt: '' });
$('q').addEventListener('input', render);
$('sort').addEventListener('change', render);

if (!CFG.CLIENT_ID) { $('demo').hidden = false; setRows(DEMO); }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
