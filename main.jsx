import React, {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams} from 'react-router-dom';
import {Activity, Bot, Camera, CheckCircle2, Clock3, Database, Download, FileText, History, Home, Languages, LogOut, Menu, Mic, Moon, QrCode, RefreshCw, ScanLine, Send, Settings, ShieldCheck, Sparkles, Sun, Thermometer, User, Users, Volume2, Wifi, X, Zap} from 'lucide-react';
import {QRCodeCanvas} from 'qrcode.react';
import './styles.css';
import {LANGUAGES, t, translations} from './translations.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const FEEDS = ['Cattle Feed Pellet', 'Silage', 'Mineral Mixture', 'Feed Mash', 'Mixed Feed'];

const FEED_KEYS = {
  'Cattle Feed Pellet': 'feed_pellet',
  'Silage': 'feed_silage',
  'Mineral Mixture': 'feed_mineral',
  'Feed Mash': 'feed_mash',
  'Mixed Feed': 'feed_mixed'
};

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (k, params) => k,
  currentMeta: LANGUAGES[0]
});

export function useLanguage() {
  return useContext(LanguageContext);
}

function LanguageProvider({children}) {
  const [lang, setLangState] = useState(() => localStorage.getItem('feedsense_lang') || 'en');
  const setLang = (newLang) => {
    setLangState(newLang);
    localStorage.setItem('feedsense_lang', newLang);
  };
  const currentMeta = useMemo(() => LANGUAGES.find(l => l.code === lang) || LANGUAGES[0], [lang]);
  const translate = (key, params) => t(key, lang, params);
  return (
    <LanguageContext.Provider value={{lang, setLang, t: translate, currentMeta}}>
      {children}
    </LanguageContext.Provider>
  );
}

function LanguageSelector({className = ''}) {
  const {lang, setLang} = useLanguage();
  return (
    <div className={`lang-pill ${className}`}>
      <Languages size={15} />
      <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Select Language">
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>
            {l.nativeName} ({l.label})
          </option>
        ))}
      </select>
    </div>
  );
}

async function api(path, options = {}) {
  const token = localStorage.getItem('feedsense_token') || '';
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, {...options, headers});
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.blob();
  if (!res.ok) throw new Error(body?.detail || `API error ${res.status}`);
  return body;
}

function speak(text, speechTag = 'en-IN') {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechTag;
    window.speechSynthesis.speak(u);
  }
}

function formatStatus(status, t) {
  if (status === 'GOOD') return t('status_good');
  if (status === 'MODERATE') return t('status_moderate');
  if (status === 'POOR') return t('status_poor');
  if (status === 'UNSAFE') return t('status_unsafe');
  return status || t('status_unknown');
}

function formatSand(x, t) {
  const map = {
    no_sand: t('no_sand'),
    low_sand: t('low_sand'),
    medium_sand: t('medium_sand'),
    high_sand: t('high_sand'),
    invalid_sample: t('invalid_sample'),
    UNVERIFIED_MODEL_MAPPING: t('model_mapping_unverified'),
    'Sand model unavailable': t('sand_model_unavailable')
  };
  return map[x] || x || t('not_tested');
}

function formatAdvisory(adv, t) {
  if (!adv) return adv;
  if (adv.includes('Moisture is elevated')) return t('adv_moisture');
  if (adv.includes('Protein estimate is low')) return t('adv_protein');
  if (adv.includes('Fiber level is high')) return t('adv_fiber');
  if (adv.includes('Potential chemical contamination')) return t('adv_chemical');
  if (adv.includes('Sand/sediment contamination')) return t('adv_sand');
  if (adv.includes('No major warning')) return t('adv_ok');
  return adv;
}

function useTheme() {
  const [dark, setDark] = useState(localStorage.getItem('feedsense_dark') === '1');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('feedsense_dark', dark ? '1' : '0');
  }, [dark]);
  return [dark, setDark];
}

function App() {
  const [dark, setDark] = useTheme();
  return (
    <Routes>
      <Route path="/" element={<Navigate to={localStorage.getItem('feedsense_token') ? '/app' : '/login'} replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/trace/:token" element={<PublicTrace />} />
      <Route path="/app/*" element={<Protected dark={dark} setDark={setDark} />} />
    </Routes>
  );
}

function Protected({dark, setDark}) {
  const {t} = useLanguage();
  const nav = useNavigate();
  const profile = JSON.parse(localStorage.getItem('feedsense_profile') || 'null');
  if (!localStorage.getItem('feedsense_token')) return <Navigate to="/login" replace />;
  const [open, setOpen] = useState(false);
  const logout = () => {
    localStorage.clear();
    nav('/login');
  };
  const role = profile?.user_id === 'A001' ? t('admin_workspace') : t('farmer_workspace');

  return (
    <div className="app-shell">
      <aside className={open ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <div className="brand-icon"><ScanLine size={22} /></div>
          <div><b>{t('brand_name')}</b><span>{t('brand_sub')}</span></div>
          <button className="icon-btn mobile-close" onClick={() => setOpen(false)}><X /></button>
        </div>
        <NavItem to="/app" icon={<Home />} text={t('dashboard')} close={() => setOpen(false)} />
        <NavItem to="/app/test" icon={<Zap />} text={t('new_test')} close={() => setOpen(false)} />
        <NavItem to="/app/history" icon={<History />} text={t('test_history')} close={() => setOpen(false)} />
        <NavItem to="/app/profile" icon={<User />} text={t('farmer_profile')} close={() => setOpen(false)} />
        {profile?.user_id === 'A001' && <NavItem to="/app/admin" icon={<ShieldCheck />} text={t('admin_console')} close={() => setOpen(false)} />}
        <div className="sidebar-spacer" />
        <LanguageSelector className="sidebar-lang" />
        <button className="nav-button" onClick={() => setDark(!dark)}>
          {dark ? <Sun /> : <Moon />}<span>{dark ? t('light_mode') : t('dark_mode')}</span>
        </button>
        <button className="nav-button" onClick={logout}>
          <LogOut /><span>{t('sign_out')}</span>
        </button>
      </aside>
      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setOpen(true)}><Menu /></button>
          <div>
            <small>{t('brand_name')} {t('brand_sub')}</small>
            <h1>{role}</h1>
          </div>
          <div className="top-actions">
            <LanguageSelector />
            <StatusChip />
            <span className="user-pill"><User size={16} />{profile?.name || profile?.username}</span>
          </div>
        </header>
        <div className="content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="test" element={<TestFlow />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="profile" element={<Profile />} />
            <Route path="admin" element={<Admin />} />
          </Routes>
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}

function NavItem({to, icon, text, close}) {
  const loc = useLocation();
  const nav = useNavigate();
  const active = loc.pathname === to;
  return (
    <button className={active ? 'nav-button active' : 'nav-button'} onClick={() => { close(); nav(to); }}>
      {icon}<span>{text}</span>
    </button>
  );
}

function StatusChip() {
  const {t} = useLanguage();
  const [ok, setOk] = useState(null);
  useEffect(() => {
    api('/health').then(() => setOk(true)).catch(() => setOk(false));
  }, []);
  return (
    <span className={ok ? 'status-chip ok' : 'status-chip bad'}>
      <Wifi size={14} />{ok ? t('backend_online') : t('backend_offline')}
    </span>
  );
}

function Login() {
  const {t} = useLanguage();
  const nav = useNavigate();
  const [f, setF] = useState({username: '', password: ''});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const d = await api('/auth/login', {method: 'POST', body: JSON.stringify(f)});
      localStorage.setItem('feedsense_token', d.access_token);
      localStorage.setItem('feedsense_profile', JSON.stringify(d.profile));
      nav('/app');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-lang"><LanguageSelector /></div>
        <div className="brand big">
          <div className="brand-icon"><ScanLine /></div>
          <div><b>{t('brand_name')}</b><span>{t('brand_sub')}</span></div>
        </div>
        <p className="muted">{t('login_subtitle')}</p>
        <form onSubmit={submit}>
          <label>{t('username')}<input required value={f.username} onChange={e => setF({...f, username: e.target.value})} /></label>
          <label>{t('password')}<input type="password" required value={f.password} onChange={e => setF({...f, password: e.target.value})} /></label>
          {err && <div className="error">{err}</div>}
          <button className="primary wide" disabled={busy}>{busy ? t('signing_in') : t('sign_in')}</button>
        </form>
        <div className="auth-foot">
          {t('new_farmer')} <button className="link" onClick={() => nav('/register')}>{t('create_account')}</button>
        </div>
      </div>
    </div>
  );
}

function Register() {
  const {t} = useLanguage();
  const nav = useNavigate();
  const [f, setF] = useState({name: '', username: '', password: '', phone: '', herd_size: 1, avg_milk_l_day: 0, stage: 'Lactating', cow_types: ['A2 Local']});
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setErr('');
    try {
      await api('/auth/register', {method: 'POST', body: JSON.stringify(f)});
      const d = await api('/auth/login', {method: 'POST', body: JSON.stringify({username: f.username, password: f.password})});
      localStorage.setItem('feedsense_token', d.access_token);
      localStorage.setItem('feedsense_profile', JSON.stringify(d.profile));
      nav('/app');
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card wide-card">
        <div className="auth-lang"><LanguageSelector /></div>
        <div className="auth-title">
          <button className="icon-btn" onClick={() => nav('/login')}>←</button>
          <div>
            <h2>{t('create_profile')}</h2>
            <p className="muted">{t('reg_subtitle')}</p>
          </div>
        </div>
        <form onSubmit={submit} className="grid-2">
          <label>{t('full_name')}<input required value={f.name} onChange={e => setF({...f, name: e.target.value})} /></label>
          <label>{t('username')}<input required value={f.username} onChange={e => setF({...f, username: e.target.value})} /></label>
          <label>{t('password')}<input type="password" required value={f.password} onChange={e => setF({...f, password: e.target.value})} /></label>
          <label>{t('phone')}<input value={f.phone} onChange={e => setF({...f, phone: e.target.value})} /></label>
          <label>{t('herd_size')}<input type="number" min="1" value={f.herd_size} onChange={e => setF({...f, herd_size: +e.target.value})} /></label>
          <label>{t('milk_per_day')}<input type="number" min="0" value={f.avg_milk_l_day} onChange={e => setF({...f, avg_milk_l_day: +e.target.value})} /></label>
          <label>{t('stage')}
            <select value={f.stage} onChange={e => setF({...f, stage: e.target.value})}>
              <option value="Lactating">{t('stage_lactating')}</option>
              <option value="Dry">{t('stage_dry')}</option>
              <option value="Growing">{t('stage_growing')}</option>
            </select>
          </label>
          <label>{t('cattle_type')}
            <select value={f.cow_types[0]} onChange={e => setF({...f, cow_types: [e.target.value]})}>
              <option>A2 Local</option>
              <option>Jersey</option>
              <option>HF Cross</option>
              <option>Gir</option>
            </select>
          </label>
          {err && <div className="error full">{err}</div>}
          <button className="primary wide full">{t('create_and_signin')}</button>
        </form>
      </div>
    </div>
  );
}

function Dashboard() {
  const {t} = useLanguage();
  const [profile] = useState(JSON.parse(localStorage.getItem('feedsense_profile') || '{}'));
  const [history, setHistory] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    if (profile.user_id) api(`/tests?user_id=${encodeURIComponent(profile.user_id)}`).then(setHistory).catch(() => {});
  }, [profile.user_id]);

  const counts = useMemo(() => ({
    total: history.length,
    good: history.filter(x => x.status === 'GOOD').length,
    attention: history.filter(x => ['MODERATE', 'POOR', 'UNSAFE'].includes(x.status)).length
  }), [history]);

  return (
    <div>
      <section className="hero">
        <div>
          <span className="eyebrow"><Sparkles size={14} /> {t('smart_screening')}</span>
          <h2>{t('good_morning')}, {profile.name?.split(' ')[0] || t('farmer')}</h2>
          <p>{t('dashboard_hero_desc')}</p>
          <button className="primary" onClick={() => nav('/app/test')}>{t('start_new_test')} <Zap size={18} /></button>
        </div>
        <div className="hero-art"><div className="orb"><ScanLine size={54} /></div></div>
      </section>
      <div className="stats">
        <Stat title={t('total_tests')} value={counts.total} icon={<FileText />} />
        <Stat title={t('good_count')} value={counts.good} icon={<CheckCircle2 />} />
        <Stat title={t('attention_count')} value={counts.attention} icon={<Activity />} />
        <Stat title={t('herd_size')} value={profile.herd_size || 0} icon={<Users />} />
      </div>
      <div className="section-row">
        <div>
          <h3>{t('quick_actions')}</h3>
          <p className="muted">{t('quick_actions_sub')}</p>
        </div>
      </div>
      <div className="cards-3">
        <Action title={t('run_feed_test')} text={t('run_feed_test_desc')} icon={<Camera />} onClick={() => nav('/app/test')} />
        <Action title={t('voice_guide')} text={t('voice_guide_desc')} icon={<Mic />} onClick={() => document.querySelector('.chat-fab')?.click()} />
        <Action title={t('trace_reports')} text={t('trace_reports_desc')} icon={<QrCode />} onClick={() => nav('/app/history')} />
      </div>
    </div>
  );
}

function Stat({title, value, icon}) {
  return <div className="card stat"><div className="stat-icon">{icon}</div><div><small>{title}</small><strong>{value}</strong></div></div>;
}

function Action({title, text, icon, onClick}) {
  return (
    <button className="card action" onClick={onClick}>
      <div className="action-icon">{icon}</div>
      <div><b>{title}</b><p>{text}</p></div>
      <span>→</span>
    </button>
  );
}

function TestFlow() {
  const {t} = useLanguage();
  const [step, setStep] = useState('select');
  const [feed, setFeed] = useState(FEEDS[0]);
  const [test, setTest] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demoBypass, setDemoBypass] = useState(false);
  const silageLike = feed === 'Silage' || feed === 'Feed Mash';

  const begin = async () => {
    setBusy(true);
    setError('');
    try {
      const profile = JSON.parse(localStorage.getItem('feedsense_profile') || '{}');
      const d = await api('/tests/start', {method: 'POST', body: JSON.stringify({user_id: profile.user_id, feed_type: feed})});
      setTest(d);
      localStorage.setItem('feedsense_current_test_id', d.test_id);
      setStep('mold');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const [sensorValues, setSensorValues] = useState({});
  const [chemValues, setChemValues] = useState({});

  const finish = async (payload) => {
    setBusy(true);
    try {
      const d = await api(`/tests/${test.test_id}/finalize`, {method: 'POST', body: JSON.stringify({...sensorValues, ...chemValues, ...payload})});
      setResult(d);
      setStep('result');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="test-page">
      <div className="flow-head">
        <div>
          <span className="eyebrow"><Zap size={14} /> {t('test_label')} {test?.test_id || t('test_not_started')}</span>
          <h2>{t(FEED_KEYS[feed] || feed)} {t('screening')}</h2>
          <p className="muted">{silageLike ? t('silage_flow_desc') : t('standard_flow_desc')}</p>
        </div>
        <StepRail step={step} silageLike={silageLike} />
      </div>
      {error && <div className="error">{error}</div>}
      {step === 'select' && <SelectFeed feed={feed} setFeed={setFeed} onBegin={begin} busy={busy} />}
      {step === 'mold' && <MoldStep test={test} onDone={() => setStep(silageLike ? 'sensor' : 'chem')} />}
      {step === 'chem' && <ChemStep onDone={(vals) => { setChemValues(vals); setStep('optical'); }} />}
      {step === 'optical' && <OpticalStep onDone={() => setStep('sand')} />}
      {step === 'sand' && <SandStep demoBypass={demoBypass} setDemoBypass={setDemoBypass} onDone={data => finish(data)} />}
      {step === 'sensor' && <SensorStep onDone={vals => { setSensorValues(vals); finish(vals); }} />}
      {step === 'result' && <ResultCard result={result} />}
    </div>
  );
}

function StepRail({step, silageLike}) {
  const {t} = useLanguage();
  const steps = silageLike ? ['select', 'mold', 'sensor', 'result'] : ['select', 'mold', 'chem', 'optical', 'sand', 'result'];
  const labels = silageLike
    ? [t('step_select'), t('step_mold'), t('step_sensor'), t('step_final')]
    : [t('step_select'), t('step_mold'), t('step_chem'), t('step_optical'), t('step_sand'), t('step_final')];
  return (
    <div className="step-rail">
      {steps.map((s, i) => (
        <div className={step === s ? 'step active' : 'step'} key={s}>
          <span>{i + 1}</span>
          <small>{labels[i]}</small>
        </div>
      ))}
    </div>
  );
}

function SelectFeed({feed, setFeed, onBegin, busy}) {
  const {t} = useLanguage();
  return (
    <div className="card flow-card">
      <div className="icon-xl"><Database /></div>
      <h3>{t('choose_sample')}</h3>
      <div className="feed-grid">
        {FEEDS.map(x => (
          <button key={x} onClick={() => setFeed(x)} className={feed === x ? 'feed-btn selected' : 'feed-btn'}>
            {t(FEED_KEYS[x] || x)}
          </button>
        ))}
      </div>
      <button className="primary" onClick={onBegin} disabled={busy}>{busy ? t('creating_test') : t('create_test_record')}</button>
    </div>
  );
}

function MoldStep({test, onDone}) {
  const {t} = useLanguage();
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [data, setData] = useState(null);

  const run = async () => {
    if (!file) return;
    setPhase('uploading');
    try {
      const fd = new FormData();
      fd.append('file', file);
      setPhase('processing');
      const d = await api(`/tests/${test.test_id}/mold`, {method: 'POST', body: fd});
      setData(d);
      setPhase('done');
    } catch (e) {
      setData({status: 'ERROR', mold: t('upload_failed'), message: e.message});
      setPhase('error');
    }
  };

  const phaseLabel = {
    idle: t('process_image'),
    uploading: t('uploading_image'),
    processing: t('running_mold_classifier'),
    done: t('done'),
    error: t('error')
  };
  const unavailable = data?.status === 'MODEL_UNAVAILABLE';

  return (
    <div className="card flow-card">
      <div className="step-title">
        <Camera />
        <div>
          <h3>{t('mold_title')}</h3>
          <p className="muted">{t('mold_desc')}</p>
        </div>
      </div>
      <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] || null)} />
      {file && <div className="file-preview">{file.name}</div>}
      <button className="secondary" onClick={run} disabled={!file || phase === 'uploading' || phase === 'processing'}>
        {phaseLabel[phase] || t('process_image')}
      </button>
      {data && (
        <div className="result-mini">
          {unavailable ? (
            <>
              <b style={{color: '#b85a00'}}>{t('mold_unavailable_title')}</b>
              <p style={{color: 'var(--muted)', margin: '6px 0 0', fontSize: '14px'}}>{data.message}</p>
            </>
          ) : (
            <>
              <b>{data.prediction === 'NO_MOLD' ? t('no_mold') : data.prediction === 'MOLD_DETECTED' ? t('mold_detected') : data.prediction || data.mold || data.status}</b>
              <span>{data.confidence != null ? `${(data.confidence * 100).toFixed(1)}% ${t('confidence')}` : ''}</span>
              <small>{data.model ? `${t('model')}: ${data.model}` : t('result_recorded')}</small>
            </>
          )}
        </div>
      )}
      <button className="primary" disabled={!data} onClick={onDone}>{t('continue')}</button>
    </div>
  );
}

function ChemStep({onDone}) {
  const {t} = useLanguage();
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('polling');
  const [errMsg, setErrMsg] = useState('');
  const timerRef = useRef(null);

  const poll = async () => {
    try {
      const x = await api('/latest');
      setD(x.optical_data || {});
      setStatus('ok');
    } catch (e) {
      setErrMsg(e.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, 1500);
    return () => clearInterval(timerRef.current);
  }, []);

  return (
    <div className="card flow-card">
      <div className="step-title">
        <ShieldCheck />
        <div>
          <h3>{t('chem_title')}</h3>
          <p className="muted">{t('chem_desc')}</p>
        </div>
      </div>
      {status === 'polling' && <p className="muted" style={{fontSize: 13}}>{t('connecting_sensor')}</p>}
      {status === 'error' && <div className="error">{errMsg || t('backend_unavailable_optical')}</div>}
      {d && (
        <div className="metric-grid">
          <Metric label={t('urea')} value={d.urea_state || t('waiting_sensor')} />
          <Metric label={t('aflatoxin')} value={d.aflatoxin_state || t('waiting_sensor')} />
        </div>
      )}
      {d?.source === 'cirkit' && <p style={{fontSize: 12, color: '#3987a2', marginTop: 4}}>{t('source_cirkit')}</p>}
      <button className="primary" disabled={!d || (d.urea_state == null && d.aflatoxin_state == null)} onClick={() => onDone({urea: d.urea_state, aflatoxin: d.aflatoxin_state})}>
        {t('continue_to_optical')}
      </button>
    </div>
  );
}

function OpticalStep({onDone}) {
  const {t} = useLanguage();
  const [d, setD] = useState(null);
  const [status, setStatus] = useState('polling');
  const timerRef = useRef(null);

  const poll = async () => {
    try {
      const x = await api('/latest');
      setD(x);
      setStatus('ok');
    } catch (e) {
      setStatus('error');
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, 1500);
    return () => clearInterval(timerRef.current);
  }, []);

  const od = d?.optical_data || {};
  return (
    <div className="card flow-card">
      <div className="step-title">
        <Activity />
        <div>
          <h3>{t('optical_title')}</h3>
          <p className="muted">{t('optical_desc')}</p>
        </div>
      </div>
      {status === 'polling' && <p className="muted" style={{fontSize: 13}}>{t('connecting_optical')}</p>}
      {status === 'error' && <div className="error">{t('backend_unavailable_opt_data')}</div>}
      {d && (
        <>
          <div className="metric-grid">
            <Metric label={t('profile')} value={od.simulated_profile || t('waiting')} />
            <Metric label="AS7265x" value={`${od.as7265x_count || 0} ${t('channels')}`} />
            <Metric label="AS7341" value={`${od.as7341_count || 0} ${t('channels')}`} />
          </div>
          {od.source === 'cirkit' && <p style={{fontSize: 12, color: '#3987a2', marginTop: 4}}>{t('source_cirkit')}</p>}
          <button className="primary" onClick={onDone}>{t('continue_to_sand')}</button>
        </>
      )}
    </div>
  );
}

function SandStep({onDone, demoBypass, setDemoBypass}) {
  const {t} = useLanguage();
  const [seconds, setSeconds] = useState(300);
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0 || demoBypass) return;
    const timer = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [seconds, demoBypass]);

  const ready = seconds === 0 || demoBypass;

  const run = async () => {
    if (!file || !ready) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const d = await api('/tests/' + currentTestId() + '/sand', {method: 'POST', body: fd});
      setData(d);
    } catch (e) {
      setData({sand: 'Sand model unavailable', note: e.message});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card flow-card">
      <div className="step-title">
        <Clock3 />
        <div>
          <h3>{t('sand_title')}</h3>
          <p className="muted">{t('sand_desc')}</p>
        </div>
      </div>
      <div className="timer">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</div>
      <button className="secondary" onClick={() => setDemoBypass(true)} disabled={ready}>{t('demo_bypass_btn')}</button>
      <div className="warning">{t('demo_bypass_note')}</div>
      {ready && <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] || null)} />}
      <button className="secondary" onClick={run} disabled={!file || !ready || busy}>
        {busy ? t('processing') : t('analyze_sediment')}
      </button>
      {data && (
        <div className="result-mini">
          <b>{formatSand(data.sand, t)}</b>
          <span>{data.confidence ? `${(data.confidence * 100).toFixed(1)}%` : ''}</span>
          <small>{data.note || `${t('model')}: ${data.mode || 'keras'}`}</small>
        </div>
      )}
      <button className="primary" disabled={!data} onClick={() => onDone({sand: data.sand})}>
        {t('generate_final_result')}
      </button>
    </div>
  );
}

function currentTestId() {
  return localStorage.getItem('feedsense_current_test_id') || '';
}

function SensorStep({onDone}) {
  const {t} = useLanguage();
  const [d, setD] = useState(null);
  const [connStatus, setConnStatus] = useState('connecting');
  const [errMsg, setErrMsg] = useState('');
  const timerRef = useRef(null);
  const latestRef = useRef(null);

  const poll = async () => {
    try {
      const x = await api('/sensor-data/latest');
      if (x.available) {
        setD(x);
        latestRef.current = x;
        setConnStatus('connected');
      } else {
        setConnStatus('waiting');
      }
    } catch (e) {
      setErrMsg(e.message);
      setConnStatus('error');
    }
  };

  useEffect(() => {
    poll();
    timerRef.current = setInterval(poll, 1500);
    return () => clearInterval(timerRef.current);
  }, []);

  const fmtTime = ts => {
    try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
  };

  const statusLabel = {
    connecting: t('sensor_connecting'),
    waiting: t('sensor_waiting'),
    connected: t('sensor_connected'),
    error: t('sensor_error')
  };

  const handleDone = () => {
    const v = latestRef.current || {};
    onDone({ph: v.ph ?? null, moisture_pct: v.moisture_pct ?? null, temperature_c: v.temperature_c ?? null});
  };

  return (
    <div className="card flow-card">
      <div className="step-title">
        <Thermometer />
        <div>
          <h3>{t('silage_sensor_title')}</h3>
          <p className="muted">{t('silage_sensor_desc')}</p>
        </div>
      </div>
      <div style={{fontSize: 13, fontWeight: 600, margin: '10px 0', color: connStatus === 'connected' ? '#2f8460' : connStatus === 'error' ? '#a14f4f' : 'var(--muted)'}}>
        {statusLabel[connStatus] || '…'}
      </div>
      {connStatus === 'error' && <div className="error">{errMsg || t('sensor_cannot_reach')}</div>}
      {d && (
        <>
          <div className="metric-grid">
            <Metric label={t('ph')} value={d.ph ?? t('waiting')} />
            <Metric label={t('moisture')} value={d.moisture_pct != null ? `${d.moisture_pct}%` : t('waiting')} />
            <Metric label={t('temperature')} value={d.temperature_c != null ? `${d.temperature_c} °C` : t('waiting')} />
            <Metric label={t('ensiled')} value={d.days_ensiled != null ? `${d.days_ensiled} ${t('days')}` : '—'} />
          </div>
          {d.simulation_mode && <p style={{fontSize: 12, color: '#3987a2', margin: '4px 0'}}>{t('source_cirkit')}</p>}
          {d.received_at && <p style={{fontSize: 11, color: 'var(--muted)', margin: '2px 0'}}>{t('last_updated')}: {fmtTime(d.received_at)}</p>}
        </>
      )}
      {(connStatus === 'connected' || connStatus === 'waiting') && !d && (
        <p style={{fontSize: 13, color: 'var(--muted)'}}>{t('waiting_first_packet')}</p>
      )}
      <button className="primary" disabled={!d || connStatus === 'error'} onClick={handleDone}>
        {t('use_values_generate')}
      </button>
    </div>
  );
}

function Metric({label, value}) {
  return <div className="metric"><small>{label}</small><b>{value}</b></div>;
}

function ResultCard({result}) {
  const {t, currentMeta} = useLanguage();
  const [pdf, setPdf] = useState(false);
  const token = result?.qr_token;
  const publicUrl = token ? `${window.location.origin}/trace/${token}` : '';

  const download = async () => {
    setPdf(true);
    try {
      const blob = await api(`/reports/${result.test_id}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${result.test_id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdf(false);
    }
  };

  const handleReadAloud = () => {
    if (!token) return;
    const statusText = formatStatus(result?.status, t);
    const firstAdv = result?.advisory?.[0] ? formatAdvisory(result.advisory[0], t) : '';
    speak(`${t('read_result_prefix')} ${statusText}. ${firstAdv}`, currentMeta.speechTag);
  };

  return (
    <div className="result-layout">
      <div className="card result-main">
        <div className="result-badge">
          <CheckCircle2 size={28} />
          <div>
            <small>{t('screening_complete')}</small>
            <strong>{formatStatus(result?.status, t)}</strong>
          </div>
        </div>
        <h2>{t(FEED_KEYS[result?.feed_type] || result?.feed_type)}</h2>
        <div className="metric-grid">
          <Metric label={t('step_mold')} value={result?.mold === 'NO_MOLD' ? t('no_mold') : result?.mold === 'MOLD_DETECTED' ? t('mold_detected') : result?.mold || t('not_tested')} />
          <Metric label={t('urea')} value={result?.urea || t('not_tested')} />
          <Metric label={t('aflatoxin')} value={result?.aflatoxin || t('not_tested')} />
          <Metric label={t('sand')} value={formatSand(result?.sand, t)} />
          <Metric label={t('ph')} value={result?.metrics?.ph ?? t('not_tested')} />
          <Metric label={t('moisture')} value={result?.metrics?.moisture_pct != null ? `${result.metrics.moisture_pct}%` : t('not_tested')} />
          {result?.metrics?.protein_pct != null && <Metric label={t('protein')} value={`${result.metrics.protein_pct}%`} />}
          {result?.metrics?.fiber_pct != null && <Metric label={t('fiber')} value={`${result.metrics.fiber_pct}%`} />}
        </div>
        <div className="advice">
          <h3>{t('recommendations')}</h3>
          {(result?.advisory || []).map((x, i) => (
            <p key={i}>• {formatAdvisory(x, t)}</p>
          ))}
        </div>
        <div className="button-row">
          <button className="primary" onClick={download}>
            {pdf ? <RefreshCw className="spin" /> : <Download />} {t('download_pdf')}
          </button>
          <button className="secondary" onClick={handleReadAloud}>
            <Volume2 /> {t('read_aloud')}
          </button>
        </div>
      </div>
      <div className="card qr-card">
        <QrCode />
        <h3>{t('traceable_qr')}</h3>
        {token ? (
          <>
            <QRCodeCanvas value={publicUrl} size={180} includeMargin />
            <small>{t('public_verification_link')}</small>
            <code>{publicUrl}</code>
          </>
        ) : (
          <span>{t('qr_unavailable')}</span>
        )}
      </div>
    </div>
  );
}

function HistoryPage() {
  const {t} = useLanguage();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const profile = JSON.parse(localStorage.getItem('feedsense_profile') || '{}');

  useEffect(() => {
    api(`/tests?user_id=${encodeURIComponent(profile.user_id)}`).then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>{t('test_history')}</h2>
          <p className="muted">{t('quick_actions_sub')}</p>
        </div>
        <button className="secondary" onClick={() => location.reload()}><RefreshCw /> {t('refresh')}</button>
      </div>
      <div className="card table-card">
        {loading ? (
          <p>{t('loading')}</p>
        ) : rows.length === 0 ? (
          <p className="muted">{t('no_tests')}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('test_id')}</th>
                  <th>{t('feed')}</th>
                  <th>{t('status')}</th>
                  <th>{t('ph')}</th>
                  <th>{t('moisture')}</th>
                  <th>{t('date')}</th>
                  <th>{t('qr')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id}>
                    <td><b>{r.id}</b></td>
                    <td>{t(FEED_KEYS[r.feed_type] || r.feed_type)}</td>
                    <td><span className="status-pill">{formatStatus(r.status, t)}</span></td>
                    <td>{r.ph ?? '—'}</td>
                    <td>{r.moisture != null ? `${r.moisture}%` : '—'}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td><a className="link" href={`/trace/${r.qr_token}`} target="_blank">{t('open')}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Profile() {
  const {t} = useLanguage();
  const [p] = useState(JSON.parse(localStorage.getItem('feedsense_profile') || '{}'));
  return (
    <div>
      <div className="page-title">
        <div>
          <h2>{t('farmer_profile')}</h2>
          <p className="muted">{t('profile_desc')}</p>
        </div>
      </div>
      <div className="profile-grid">
        <div className="card">
          <div className="avatar"><User size={32} /></div>
          <h3>{p.name}</h3>
          <p className="muted">{p.username}</p>
          <div className="metric-grid">
            <Metric label={t('phone')} value={p.phone || '—'} />
            <Metric label={t('herd_size')} value={p.herd_size || 0} />
            <Metric label={t('milk_per_day')} value={`${p.avg_milk_l_day || 0} L`} />
            <Metric label={t('stage')} value={p.stage || '—'} />
          </div>
        </div>
        <div className="card">
          <h3>{t('cattle_composition')}</h3>
          {(p.cattle || []).map((c, i) => (
            <div className="cattle-row" key={i}>
              <span>{c.type}</span><b>{c.count}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Admin() {
  const {t} = useLanguage();
  const [health, setHealth] = useState(null);
  const load = () => api('/health').then(setHealth).catch(e => setHealth({error: e.message}));
  useEffect(load, []);

  return (
    <div>
      <div className="page-title">
        <div>
          <h2>{t('admin_console')}</h2>
          <p className="muted">{t('admin_desc')}</p>
        </div>
        <button className="secondary" onClick={load}><RefreshCw /> {t('refresh')}</button>
      </div>
      <div className="cards-3">
        <div className="card">
          <Database /><h3>{t('database')}</h3><p>{health?.database || '—'}</p>
        </div>
        <div className="card">
          <ShieldCheck /><h3>{t('api')}</h3><p>{health?.status || '—'}</p>
        </div>
        <div className="card">
          <Activity /><h3>{t('models')}</h3><pre>{JSON.stringify(health?.models || {}, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}

function ChatWidget() {
  const {t, currentMeta} = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {from: 'ai', text: t('assistant_greeting')}
  ]);
  const [q, setQ] = useState('');
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  // Update initial greeting when language changes if no messages have been sent yet
  useEffect(() => {
    setMessages(m => {
      if (m.length === 1 && m[0].from === 'ai') {
        return [{from: 'ai', text: t('assistant_greeting')}];
      }
      return m;
    });
  }, [currentMeta.code]);

  const answer = (text) => {
    const lower = text.toLowerCase();
    let out = t('ans_default');
    if (lower.includes('silage') || lower.includes('சைலேஜ்') || lower.includes('साइलेज') || lower.includes('సైలేజ్') || lower.includes('സൈലേജ്')) {
      out = t('ans_silage');
    } else if (lower.includes('sand') || lower.includes('மணல்') || lower.includes('बालू') || lower.includes('ఇసుక') || lower.includes('മണൽ')) {
      out = t('ans_sand');
    } else if (lower.includes('urea') || lower.includes('aflatoxin') || lower.includes('யூரியா') || lower.includes('यूरिया') || lower.includes('యూరియా') || lower.includes('അഫ്ലാടോക്സിൻ')) {
      out = t('ans_urea');
    } else if (lower.includes('voice') || lower.includes('குரல்') || lower.includes('आवाज़') || lower.includes('వాయిస్') || lower.includes('വോയ്‌സ്')) {
      out = t('ans_voice');
    }
    setMessages(m => [...m, {from: 'user', text}, {from: 'ai', text: out}]);
    speak(out, currentMeta.speechTag);
    setQ('');
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert(t('speech_unsupported'));
      return;
    }
    const r = new SR();
    r.lang = currentMeta.speechTag;
    r.onstart = () => setListening(true);
    r.onend = () => setListening(false);
    r.onresult = e => answer(e.results[0][0].transcript);
    recRef.current = r;
    r.start();
  };

  return (
    <>
      {open && (
        <div className="chat-panel">
          <div className="chat-head">
            <div>
              <b>{t('assistant_title')}</b>
              <small>{t('assistant_sub')}</small>
            </div>
            <button className="icon-btn" onClick={() => setOpen(false)}><X /></button>
          </div>
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={m.from === 'ai' ? 'chat-msg ai' : 'chat-msg user'}>{m.text}</div>
            ))}
          </div>
          <div className="chat-compose">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && q.trim() && answer(q)}
              placeholder={t('ask_placeholder')}
            />
            <button className={listening ? 'icon-btn active' : 'icon-btn'} onClick={startVoice}>
              {listening ? <Activity /> : <Mic />}
            </button>
            <button className="icon-btn" onClick={() => q.trim() && answer(q)}><Send /></button>
          </div>
        </div>
      )}
      <button className="chat-fab" onClick={() => setOpen(!open)}>{open ? <X /> : <Bot />}</button>
    </>
  );
}

function PublicTrace() {
  const {t} = useLanguage();
  const {token} = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) {
      setErr(t('trace_invalid_token'));
      return;
    }
    fetch(`${API_BASE}/trace/${token}`)
      .then(async r => {
        if (!r.ok) throw new Error(t('trace_not_found'));
        return r.json();
      })
      .then(setData)
      .catch(e => setErr(e.message));
  }, [token]);

  return (
    <div className="public-trace">
      <div className="trace-card">
        <div className="auth-lang"><LanguageSelector /></div>
        <div className="brand big">
          <div className="brand-icon"><ScanLine /></div>
          <div><b>{t('brand_name')}</b><span>{t('brand_sub')}</span></div>
        </div>
        <span className="verified"><ShieldCheck size={16} /> {t('public_trace_title')}</span>
        {err ? (
          <div className="error">{err}</div>
        ) : !data ? (
          <p>{t('loading')}</p>
        ) : (
          <>
            <h1>{formatStatus(data.status, t)}</h1>
            <p className="muted">{t(FEED_KEYS[data.feed_type] || data.feed_type)} · {data.test_id}</p>
            <div className="metric-grid">
              <Metric label={t('step_mold')} value={data.mold === 'NO_MOLD' ? t('no_mold') : data.mold === 'MOLD_DETECTED' ? t('mold_detected') : data.mold || t('not_tested')} />
              <Metric label={t('urea')} value={data.urea || t('not_tested')} />
              <Metric label={t('aflatoxin')} value={data.aflatoxin || t('not_tested')} />
              <Metric label={t('sand')} value={formatSand(data.sand, t)} />
              <Metric label={t('ph')} value={data.metrics?.ph ?? t('not_tested')} />
              <Metric label={t('moisture')} value={data.metrics?.moisture_pct != null ? `${data.metrics.moisture_pct}%` : t('not_tested')} />
            </div>
            <small>{t('created_at')} {new Date(data.created_at).toLocaleString()}</small>
          </>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </BrowserRouter>
);
