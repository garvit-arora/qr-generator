import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

function Icon({ name, ...props }) {
  const paths = {
    plus: <path d="M12 4v16M4 12h16" />,
    arrow: <path d="M12 19V5m-6 6 6-6 6 6" />,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></>,
    qr: <><path d="M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0v3h3v3h3v-6M12 12h3m6 0v1" /></>,
    barcode: <path d="M3 5v14M6 5v14M10 5v14M12 5v14M16 5v14M19 5v14M21 5v14" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    link: <><path d="m10 14 4-4m-5 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m0 10a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-1 1" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

const initialOptions = { size: '1024', foreground: '#000000', background: '#ffffff', transparent: false, showText: true };
const QR_ERROR_CORRECTION = 'M';
const BARCODE_FORMAT = 'CODE128';

export default function App() {
  const [mode, setMode] = useState('qr');
  const [drafts, setDrafts] = useState({ qr: '', barcode: '' });
  const [options, setOptions] = useState(initialOptions);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null), request = useRef(0);
  const value = drafts[mode];
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2800); return () => clearTimeout(timer); }, [notice]);
  // Invalidate an export whenever its source or settings change.
  useEffect(() => { request.current++; setResult(null); setError(''); setBusy(false); }, [mode, value, options]);
  function switchMode(next) { setMode(next); setSettingsOpen(false); }
  function updateOption(key, value) { setOptions(previous => ({ ...previous, [key]: value })); }
  async function generate(event) {
    event?.preventDefault();
    const id = ++request.current;
    setError('');
    if (!value.trim()) { setError(mode === 'qr' ? 'Enter a website link or text to create your QR code.' : 'Enter a value to create your barcode.'); inputRef.current?.focus(); return; }
    if (!options.transparent && options.foreground.toLowerCase() === options.background.toLowerCase()) { setError('Choose different code and background colors.'); setSettingsOpen(true); return; }
    setBusy(true);
    try {
      let dataURL, svg, width, height;
      if (mode === 'qr') {
        const settings = { errorCorrectionLevel: QR_ERROR_CORRECTION, margin: 4, width: Number(options.size), color: { dark: options.foreground, light: options.transparent ? '#00000000' : options.background } };
        dataURL = await QRCode.toDataURL(value, settings);
        svg = await QRCode.toString(value, { ...settings, type: 'svg' });
        width = height = Number(options.size);
      } else {
        if (value.length > 100) throw new Error('Keep barcode content under 100 characters for a readable result.');
        if (/[\r\n]/.test(value)) throw new Error('Use a single line for barcode content.');
        const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        let valid = true;
        JsBarcode(element, value, { format: BARCODE_FORMAT, lineColor: options.foreground, background: options.transparent ? 'transparent' : options.background, width: 3, height: 120, displayValue: options.showText, font: 'monospace', fontSize: 19, margin: 24, valid: result => { valid = result; } });
        if (!valid) throw new Error('Use ASCII letters, numbers, or symbols for your barcode.');
        element.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg = new XMLSerializer().serializeToString(element);
        const image = new Image();
        const source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        try {
          await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Unable to render this barcode.')); image.src = source; });
          const canvas = document.createElement('canvas');
          width = canvas.width = image.naturalWidth * 2; height = canvas.height = image.naturalHeight * 2;
          canvas.getContext('2d').drawImage(image, 0, 0, width, height);
          dataURL = canvas.toDataURL('image/png');
        } finally { URL.revokeObjectURL(source); }
      }
      if (id === request.current) setResult({ mode, dataURL, svg, width, height, value, transparent: options.transparent });
    } catch (error) {
      if (id === request.current) { setResult(null); setError(/amount of data|too big/i.test(error.message) ? 'This content is too long. Shorten it and try again.' : error.message || 'Unable to generate this code.'); }
    } finally { if (id === request.current) setBusy(false); }
  }
  function download(type) {
    if (!result) return;
    const link = document.createElement('a');
    const url = type === 'svg' ? URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' })) : result.dataURL;
    link.href = url; link.download = `gautam-graphics-${result.mode === 'qr' ? 'qr-code' : 'barcode'}.${type}`; link.click();
    if (type === 'svg') setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`${type.toUpperCase()} downloaded`);
  }
  async function copy() {
    try { await navigator.clipboard.writeText(value); setNotice('Content copied'); }
    catch { setNotice('Copy is unavailable in this browser.'); }
  }
  return <div className="app">
    <header className="topbar">
      <a href="./" className="brand" aria-label="Gautam Graphics QR home"><Icon name="qr" /><span>Gautam Graphics <b>QR</b></span></a>
      <div className="mode-switch" role="tablist" aria-label="Generator type">
        {['qr', 'barcode'].map(type => <button key={type} id={`${type}-tab`} type="button" role="tab" aria-selected={mode === type} aria-controls="generator" tabIndex={mode === type ? 0 : -1} onClick={() => switchMode(type)} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'qr' : event.key === 'End' ? 'barcode' : mode === 'qr' ? 'barcode' : 'qr'; switchMode(next); document.getElementById(`${next}-tab`).focus(); } }}>{type === 'qr' ? 'QR Code' : 'Barcode'}</button>)}
      </div>
      <span className="private-label"><span />Local & private</span>
    </header>
    <main className={`main ${result ? 'has-result' : ''}`} id="generator" role="tabpanel" aria-labelledby={`${mode}-tab`}>
      <div className="composer-group">
        <h1>{mode === 'qr' ? 'What would you like to turn into a QR?' : 'What would you like to turn into a barcode?'}</h1>
        <form onSubmit={generate} className={`composer ${error ? 'has-error' : ''}`}>
          <button type="button" className={`icon-button settings-button ${settingsOpen ? 'is-open' : ''}`} aria-label="Customize code" aria-expanded={settingsOpen} aria-controls="customize" onClick={() => setSettingsOpen(open => !open)}><Icon name="plus" /></button>
          <input ref={inputRef} value={value} onChange={event => setDrafts(previous => ({ ...previous, [mode]: event.target.value }))} placeholder={mode === 'qr' ? 'Enter a link or text' : 'Enter a number or product code'} aria-label={mode === 'qr' ? 'QR code content' : 'Barcode content'} aria-describedby={error ? 'error' : 'static-note'} maxLength={mode === 'qr' ? 2000 : 100} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          <button type="submit" className="generate-button" disabled={busy} aria-label={busy ? 'Generating code' : 'Generate code'} title="Generate code">{busy ? <span className="spinner" /> : <Icon name={mode === 'qr' ? 'qr' : 'barcode'} />}</button>
        </form>
        {error && <p className="error" id="error" role="alert">{error}</p>}
        {settingsOpen && <section className="customize" id="customize" aria-label="Customize your code">
          <div className="customize-title"><span>Customize your {mode === 'qr' ? 'QR code' : 'barcode'}</span><button className="icon-button" type="button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><Icon name="close" /></button></div>
          <div className="background-switch" role="group" aria-label="Background style"><button type="button" aria-pressed={!options.transparent} onClick={() => updateOption('transparent', false)}>With background</button><button type="button" aria-pressed={options.transparent} onClick={() => updateOption('transparent', true)}>No background</button></div>
          <div className="option-grid"><label>Code color<div className="color-field"><input type="color" value={options.foreground} onChange={e => updateOption('foreground', e.target.value)} /><span>{options.foreground.toUpperCase()}</span></div></label><label>Background<div className={`color-field ${options.transparent ? 'is-disabled' : ''}`}><input type="color" value={options.background} disabled={options.transparent} onChange={e => updateOption('background', e.target.value)} /><span>{options.transparent ? 'Transparent' : options.background.toUpperCase()}</span></div></label>{mode === 'qr' ? <label>Export size<select value={options.size} onChange={e => updateOption('size', e.target.value)}><option value="256">256 × 256 px</option><option value="512">512 × 512 px</option><option value="1024">1024 × 1024 px</option><option value="2048">2048 × 2048 px</option></select></label> : <label className="show-text"><input type="checkbox" checked={options.showText} onChange={e => updateOption('showText', e.target.checked)} />Show barcode value</label>}</div>
          <p className="setting-help">{options.transparent ? 'PNG and SVG downloads will be transparent. Place the code on a contrasting surface and keep its clear margin.' : 'Use a dark code on a light background for reliable scanning.'}</p>
        </section>}
        {!result && <div className="suggestions"><button type="button" onClick={() => { setDrafts(previous => ({ ...previous, [mode]: mode === 'qr' ? 'https://example.com' : '123456789012' })); inputRef.current?.focus(); }}><span className="suggestion-icon"><Icon name={mode === 'qr' ? 'link' : 'barcode'} /></span>{mode === 'qr' ? 'Try a website link, a message, or your contact details' : 'Create a clean, scannable code for a product or label'}</button></div>}
        {result && <section className="result" aria-label="Generated code"><div className="result-header"><span><span className="ready-dot" />Your {result.mode === 'qr' ? 'QR code' : 'barcode'} is ready</span><button className="icon-button" type="button" onClick={() => setResult(null)} aria-label="Close result"><Icon name="close" /></button></div><div className={`code-preview ${result.transparent ? 'transparent-preview' : ''} ${result.mode === 'barcode' ? 'barcode-preview' : ''}`}><img src={result.dataURL} alt={result.mode === 'qr' ? 'Generated static QR code' : 'Generated barcode'} /></div><div className="result-details"><span>{result.width} × {result.height} px</span><span>Static · No expiry</span></div><div className="result-actions"><button className="download-button" type="button" onClick={() => download('png')}><Icon name="download" />Download PNG</button><button className="secondary-button" type="button" onClick={() => download('svg')}>Download SVG</button><button className="icon-button copy-button" type="button" onClick={copy} aria-label="Copy encoded content" title="Copy encoded content"><Icon name="copy" /></button></div><p className="scan-note">Test your code with a scanner before printing.</p></section>}
      </div>
    </main>
    <footer id="static-note"><span className="infinity">∞</span><span>Static codes. No expiry. No subscriptions.<span className="footer-detail"> Linked websites must remain available.</span></span></footer>
    {notice && <div className="toast" role="status"><Icon name="check" />{notice}</div>}
  </div>;
}
