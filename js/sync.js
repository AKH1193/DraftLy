/* DraftLy real-time sync using Firebase Realtime Database (REST + live event stream). No SDK needed. */
const Sync = (() => {
  const KEY = 'draftly.sync';
  let cfg = JSON.parse(localStorage.getItem(KEY) || 'null');
  const deviceId = localStorage.getItem('draftly.device') || (() => { const d = uid(); localStorage.setItem('draftly.device', d); return d; })();
  let es = null, status = 'off', remoteMeta = {}, listeners = [], retry = 0, retryTimer = null;
  const pushTimers = {}, lastPush = {};
  const save = () => localStorage.setItem(KEY, JSON.stringify(cfg));
  const setStatus = s => { status = s; listeners.forEach(f => f('status', s)); };
  const emit = (type, data) => listeners.forEach(f => f(type, data));
  const base = () => cfg.dbUrl.replace(/\/+$/, '') + '/users/' + cfg.uid;

  async function authCall(endpoint, body) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(cfg.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(friendly(j.error && j.error.message));
    return j;
  }
  const friendly = m => ({
    EMAIL_NOT_FOUND: 'No account with that email. Choose "Create account" the first time.',
    INVALID_PASSWORD: 'Wrong password.', INVALID_LOGIN_CREDENTIALS: 'Email or password is incorrect.',
    EMAIL_EXISTS: 'That email already has an account. Use "Sign in" instead.',
    OPERATION_NOT_ALLOWED: 'Email/Password sign-in is not enabled in your Firebase project (Authentication > Sign-in method).',
    'WEAK_PASSWORD : Password should be at least 6 characters': 'Password must be at least 6 characters.',
    API_KEY_INVALID: 'The API key is not valid. Copy it again from Firebase project settings.'
  }[m] || m || 'Sign-in failed');

  async function signIn({ apiKey, dbUrl, email, password, create }) {
    cfg = { apiKey: apiKey.trim(), dbUrl: dbUrl.trim().replace(/\/+$/, ''), email: email.trim() };
    if (!/^https:\/\/.+(firebaseio\.com|firebasedatabase\.app)$/.test(cfg.dbUrl)) throw new Error('The database URL should look like https://your-project-default-rtdb.firebaseio.com');
    const j = await authCall(create ? 'signUp' : 'signInWithPassword', { email: cfg.email, password, returnSecureToken: true });
    Object.assign(cfg, { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, expiresAt: Date.now() + (+j.expiresIn || 3600) * 1000 });
    save();
    // verify database access
    const t = await fetch(`${base()}/ping.json?auth=${cfg.idToken}`, { method: 'PUT', body: JSON.stringify({ device: deviceId, at: Date.now() }) });
    if (!t.ok) { const e = await t.json().catch(() => ({})); throw new Error('Signed in, but the database refused access: ' + (e.error || t.status) + '. Check the database rules (see setup steps).'); }
    connect();
  }
  function signOut() { disconnect(); cfg = null; localStorage.removeItem(KEY); setStatus('off'); if (IN_PANE) try { window.parent.DLHost.syncReload(); } catch (e) { } }
  // main window: pick up a sign-in or sign-out made in a document pane
  function reload() {
    cfg = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!cfg || !cfg.uid) { disconnect(); setStatus('off'); }
    else if (!es || es.readyState === 2) connect();
  }
  async function token() {
    if (!cfg || !cfg.refreshToken) throw new Error('not signed in');
    if (Date.now() < cfg.expiresAt - 120000) return cfg.idToken;
    const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(cfg.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(cfg.refreshToken) });
    const j = await r.json();
    if (!r.ok) { setStatus('error'); throw new Error('Session expired. Please sign in again.'); }
    Object.assign(cfg, { idToken: j.id_token, refreshToken: j.refresh_token, expiresAt: Date.now() + (+j.expires_in || 3600) * 1000 });
    save();
    return cfg.idToken;
  }
  async function req(method, path, data) {
    const t = await token();
    const r = await fetch(`${base()}${path ? '/' + path : ''}.json?auth=${t}`, { method, body: data === undefined ? undefined : JSON.stringify(data) });
    if (!r.ok) throw new Error('Sync request failed (' + r.status + ')');
    return r.json();
  }

  async function connect() {
    // a document pane leaves the live connection to the main window, which passes changes on to it
    if (IN_PANE) { try { window.parent.DLHost.syncReload(); } catch (e) { } return; }
    disconnect();
    if (!cfg || !cfg.uid) return setStatus('off');
    if (!navigator.onLine) return setStatus('offline');
    setStatus('connecting');
    let t;
    try { t = await token(); } catch (e) { return; }
    es = new EventSource(`${base()}/meta.json?auth=${t}`);
    es.addEventListener('put', ev => { retry = 0; setStatus('live'); apply('put', ev.data); });
    es.addEventListener('patch', ev => apply('patch', ev.data));
    es.addEventListener('keep-alive', () => setStatus('live'));
    es.addEventListener('auth_revoked', () => { cfg.expiresAt = 0; reconnect(); });
    es.addEventListener('cancel', () => { setStatus('error'); reconnect(); });
    es.onerror = () => { if (es && es.readyState === 2) reconnect(); else setStatus(navigator.onLine ? 'connecting' : 'offline'); };
  }
  function reconnect() { disconnect(); clearTimeout(retryTimer); retryTimer = setTimeout(connect, Math.min(30000, 1000 * Math.pow(2, retry++))); }
  function disconnect() { if (es) { es.close(); es = null; } }
  function apply(kind, raw) {
    let msg; try { msg = JSON.parse(raw); } catch (e) { return; }
    const { path, data } = msg;
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) {
      if (kind === 'put') remoteMeta = data || {};
      else Object.assign(remoteMeta, data || {});
      emit('full', remoteMeta);
      return;
    }
    const id = parts[0];
    if (parts.length === 1) {
      if (kind === 'put') { if (data === null) delete remoteMeta[id]; else remoteMeta[id] = data; }
      else remoteMeta[id] = Object.assign(remoteMeta[id] || {}, data);
    } else {
      remoteMeta[id] = remoteMeta[id] || {};
      remoteMeta[id][parts[1]] = data;
    }
    emit('meta', { id, meta: remoteMeta[id] || null });
  }

  /* push a document (throttled: at most every ~1.5 s while typing) */
  function push(d, immediate) {
    if (!cfg || !cfg.uid || !d || d.stub) return;
    const blank = !String(d.html || '').replace(/<(?!img|table|hr)[^>]*>/g, '').trim() && !Object.keys(d.comments || {}).length && !(d.settings && (d.settings.header || d.settings.footer));
    if (blank && !d.syncedAt) return; // don't spread untouched empty documents to other devices
    clearTimeout(pushTimers[d.id]);
    const wait = immediate ? 0 : Math.max(250, 1500 - (Date.now() - (lastPush[d.id] || 0)));
    pushTimers[d.id] = setTimeout(async () => {
      lastPush[d.id] = Date.now();
      const body = { title: d.title, html: d.html, settings: d.settings, comments: d.comments || {}, modified: d.modified, created: d.created || d.modified, device: deviceId };
      const meta = { title: d.title, modified: d.modified, device: deviceId };
      try {
        await req('PATCH', '', { ['docs/' + d.id]: body, ['meta/' + d.id]: meta });
        emit('pushed', { id: d.id, modified: d.modified });
      } catch (e) { emit('pushfail', { id: d.id, error: e.message }); if (!navigator.onLine) setStatus('offline'); }
    }, wait);
  }
  async function pull(id) { return req('GET', 'docs/' + id); }
  async function remove(id) { try { await req('PATCH', '', { ['docs/' + id]: null, ['meta/' + id]: null }); } catch (e) { } }

  window.addEventListener('online', () => { if (cfg) connect(); emit('online'); });
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && cfg && (!es || es.readyState === 2)) connect(); });

  function setupLink() {
    if (!cfg) return '';
    const data = btoa(unescape(encodeURIComponent(JSON.stringify({ apiKey: cfg.apiKey, dbUrl: cfg.dbUrl, email: cfg.email }))));
    return location.origin + location.pathname + '#sync=' + data;
  }
  function readSetupLink() {
    const m = location.hash.match(/sync=([^&]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1])))); } catch (e) { return null; }
  }
  return {
    signIn, signOut, connect, reload, mirror: s => { if (IN_PANE && s !== status) setStatus(s); }, push, pull, remove, setupLink, readSetupLink,
    on: f => listeners.push(f),
    get status() { return status; }, get enabled() { return !!(cfg && cfg.uid); }, get email() { return cfg && cfg.email; },
    get cfg() { return cfg; }, get meta() { return remoteMeta; }, deviceId
  };
})();
