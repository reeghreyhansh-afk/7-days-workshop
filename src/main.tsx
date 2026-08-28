import { useState } from 'react';
import { load } from '@cashfreepayments/cashfree-js';
import { ArrowUpRight, Check, ChevronDown, Facebook, Globe, Instagram, LockKeyhole, Mail, Menu, Phone, X } from 'lucide-react';
import './index.css';
import './brand.css';

type FormData = { fullName: string; email: string; whatsapp: string; profession: string; city: string; participantType: string; socialLink: string; consent: boolean };
type Flow = 'landing' | 'register' | 'payment' | 'success';
const initialForm: FormData = { fullName: '', email: '', whatsapp: '', profession: '', city: '', participantType: '', socialLink: '', consent: false };
const days = [
  {
    number: '01',
    title: 'AI as a Design Thinking Partner',
    topics: [
      'Introduction to AI in Architecture & Interior Design',
      'Understanding AI as a Design Collaborator',
      'Understanding the Client Brief',
      'AI-Assisted Client Brief Analysis',
      'Identifying Client Needs, User Needs & Hidden Requirements',
      'Research Using ChatGPT',
      'Asking the Right Questions to AI',
      'Converting Research into Design Intelligence',
      'Creating Your Own Custom GPT for Design Research',
    ],
  },
  {
    number: '02',
    title: 'AI Concept Engine',
    topics: [
      'From Client Brief to Design Intent',
      'Converting Research into Design Opportunities',
      'AI-Assisted Concept Generation',
      'Generating Multiple Design Directions',
      'Concept Comparison & Selection',
      'Design Narrative & Rationale',
      'AI as a Design Critic',
      'Concept Stress Testing',
      'Refining the Selected Concept',
    ],
  },
  {
    number: '03',
    title: 'Material Intelligence & Visual Language',
    topics: [
      'Material Research Using ChatGPT',
      'Understanding Material Families',
      'Primary, Supporting & Accent Materials',
      'Colour & Texture Relationships',
      'Material Selection Based on Concept',
      'Creating a Material DNA',
      'Material + Concept → Visual Language',
      'AI-Assisted Moodboard Generation',
      'Developing a Professional Moodboard',
    ],
  },
  {
    number: '04',
    title: 'AI Visualization & Spatial Generation',
    topics: [
      'From Concept + Moodboard → Space',
      'Understanding AI Image Generation for Designers',
      'Anatomy of an Architectural Visualization Prompt',
      'Spatial Composition',
      'Architecture & Existing Conditions',
      'Furniture & Design Elements',
      'Materials & Finishes',
      'Lighting & Atmosphere',
      'Camera & Composition',
      'Constraints & Design Control',
      'Whole-Room Visualization Using Nano Banana Pro',
      'Creating Multiple Visual Interpretations of the Same Space',
    ],
  },
  {
    number: '05',
    title: 'AI Iteration & Video Generation',
    topics: [
      'Diagnosing an AI-Generated Design',
      'Identifying Visualization vs Design Problems',
      'Controlled AI Iteration',
      'Material Iteration',
      'Furniture Iteration',
      'Colour Iteration',
      'Lighting & Atmosphere Iteration',
      'Composition & Camera Iteration',
      'One Change at a Time — Why?',
      'Compare → Evaluate → Keep / Revert',
      'Introduction to JSON Prompting',
      'Writing a Basic JSON Prompt Yourself',
      'Generating Structured JSON Using ChatGPT',
      'Using JSON for Repeatable Design Instructions',
      'Image-to-Video for Architecture & Interior Design',
      'Camera Movement & Spatial Storytelling',
      'Creating a Short AI Design Film',
    ],
  },
  {
    number: '06',
    title: 'AI Design System & Professional Presentation',
    topics: [
      'From Individual Prompts to a Design System',
      'Creating Your Project Design DNA',
      'Structuring Client, Concept, Materials & Spatial Information',
      'Building a Reusable AI Design Workflow',
      'Using Your Custom GPT in the Design Process',
      'JSON as a Reusable Design Structure',
      'Final Room & Design Story',
      'AI-Assisted Design Presentation',
      'Creating a Presentation Using Canva AI',
      'Client Communication & Visual Storytelling',
      'Presenting the Design Journey',
      'Final Project Review',
      'Human + AI: The Future of Architectural & Interior Design',
    ],
  },
];
const learnings = ['Generative AI tools for ideation & visualization', 'AI workflows for architectural & interior design', 'Prompt engineering for design & research', 'LLM fundamentals & practical applications', 'AI for research, content analysis & synthesis'];
const audience = ['Architects', 'Interior designers', 'Design students', 'Researchers & professionals', 'The AI-curious'];

function Logo() {
  return <img className="company-logo" src="/brand/company-logo-transparent.png" alt="RéEGH" />;
}
function Price({ dark = false }: { dark?: boolean }) { return <span className={dark ? 'price price-dark' : 'price'}>₹1,499<span>/-</span></span>; }
function App() {
  const [flow, setFlow] = useState<Flow>('landing'); const [form, setForm] = useState(initialForm); const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({}); const [menu, setMenu] = useState(false); const [paymentError, setPaymentError] = useState(''); const [paymentBusy, setPaymentBusy] = useState(false);
  const goRegister = () => { setFlow('register'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const update = (key: keyof FormData, value: string | boolean) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: '' })); };
  const submit = (event: React.FormEvent) => { event.preventDefault(); const required: (keyof FormData)[] = ['fullName', 'email', 'whatsapp', 'profession', 'city', 'participantType']; const next: typeof errors = {}; required.forEach(key => { if (!form[key]) next[key] = 'Required'; }); if (!form.consent) next.consent = 'Please accept to continue'; setErrors(next); if (!Object.keys(next).length) setFlow('payment'); };
  const startPayment = async () => {
    setPaymentBusy(true); setPaymentError('');
    try {
      const orderResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/create-order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const order = await orderResponse.json();
      if (!orderResponse.ok) throw new Error(order.error || 'Unable to start payment');
      const cashfree = await load({ mode: 'sandbox' });
      if (!cashfree) throw new Error('Cashfree checkout could not load');
      const checkoutResult = await cashfree.checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: '_modal' });
      if (checkoutResult?.error) throw new Error(checkoutResult.error.message || 'Payment was not completed');
      const verificationResponse = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/verify-order/${order.orderId}`);
      const verification = await verificationResponse.json();
      if (!verificationResponse.ok || !verification.paid) throw new Error('Payment is not confirmed yet. Please try again after checking your bank or UPI app.');
      setFlow('success');
    } catch (error) { setPaymentError(error instanceof Error ? error.message : 'Unable to complete payment'); }
    finally { setPaymentBusy(false); }
  };
  if (flow === 'register' || flow === 'payment' || flow === 'success') return <FlowPage flow={flow} form={form} onChange={update} errors={errors} onSubmit={submit} onBack={() => setFlow('landing')} onPay={startPayment} paymentBusy={paymentBusy} paymentError={paymentError} />;
  return <Landing onEnroll={goRegister} menu={menu} setMenu={setMenu} />;
}
function Header({ onEnroll, menu, setMenu }: { onEnroll: () => void; menu: boolean; setMenu: (v: boolean) => void }) { return <header className="site-header"><a href="#top" className="brand-link"><Logo /></a><nav className={menu ? 'nav open' : 'nav'}><a href="#learn">The curriculum</a><a href="#days">6 days</a><a href="#who">Who it is for</a><button className="nav-cta" onClick={onEnroll}>Enroll <ArrowUpRight size={15} /></button></nav><button className="menu-button" aria-label="Toggle navigation" onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</button></header>; }
function Landing({ onEnroll, menu, setMenu }: { onEnroll: () => void; menu: boolean; setMenu: (v: boolean) => void }) { return <div id="top"><Header onEnroll={onEnroll} menu={menu} setMenu={setMenu} /><main>
  <section className="hero"><div className="hero-copy"><p className="eyebrow">One week intensive <span /> Online workshop</p><h1>Design in<br /><em>Generative AI</em><br /><span>& research in LLM</span></h1><p className="hero-sub">Design smarter. Research deeper.<br />Create impact.</p><div className="hero-actions"><button className="button button-gold" onClick={onEnroll}>Enroll now <Price /></button><a className="text-link" href="#days">View workshop <ArrowUpRight size={17} /></a></div></div><div className="hero-art"><div className="art-label">A new literacy<br /><strong>for the<br />design field</strong></div><div className="art-note">01 / 07</div></div><div className="hero-meta"><span>01</span><span>Design education for a changing practice</span><span>Scroll to explore ↓</span></div></section>
  <section className="intro section-pad"><div className="section-kicker">/ The proposition</div><div className="intro-grid"><h2>Where thoughtful<br /><span>design meets</span><br />machine intelligence.</h2><div className="intro-copy"><p>AI is not replacing the designer. It is expanding the designer's field of vision.</p><p>This seven-day intensive is a working introduction to the tools, methods and questions shaping the next chapter of creative practice.</p><a className="text-link dark-link" href="#learn">Read the curriculum <ArrowUpRight size={17} /></a></div></div></section>
  <section className="image-story section-pad" aria-label="Workshop atmosphere"><div className="section-kicker">/ Ways of seeing</div><div className="image-story-grid"><figure className="story-image story-image-tall"><img src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=85" alt="A bright creative studio workspace" loading="lazy" /><figcaption>01 / A space for making</figcaption></figure><figure className="story-image"><img src="https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1000&q=85" alt="Modern collaborative workspace" loading="lazy" /><figcaption>02 / Form, structure, possibility</figcaption></figure><figure className="story-image story-image-offset"><img src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1000&q=85" alt="Notes and tools arranged for research" loading="lazy" /><figcaption>03 / Questions worth following</figcaption></figure></div></section>
  <section className="statement"><div className="statement-inner"><span className="section-kicker">/ A working week</span><p>Less <i>prompting.</i><br />More <strong>thinking.</strong></p><span className="statement-side">01 — 07<br />A compact, rigorous<br />studio of ideas.</span></div></section>
  <section className="section-pad" id="who"><div className="section-kicker">/ Who it is for</div><div className="split-heading"><h2>Come as you are.<br /><span>Leave with a new lens.</span></h2><p>Built for people who want to make AI useful, expressive and responsible in their own practice.</p></div><div className="audience-grid">{audience.map((item, i) => <div className="audience-item" key={item}><span>0{i + 1}</span><strong>{item}</strong><ArrowUpRight size={18} /></div>)}</div></section>
  <section className="learn section-pad" id="learn"><div className="section-kicker">/ What you will learn</div><div className="learn-grid"><h2>Five shifts<br /><span>in perspective.</span></h2><div>{learnings.map((item, i) => <div className="learning" key={item}><span>0{i + 1}</span><p>{item}</p><Check size={16} /></div>)}</div></div></section>
  <section className="days section-pad" id="days"><div className="section-kicker">/ The six-day workshop</div><div className="days-head"><h2>One week.<br /><span>Real momentum.</span></h2><p>Each day builds on the last, moving from design thinking to a complete, AI-assisted design story.</p></div><div className="day-list">{days.map(({ number, title, topics }) => <details key={number} open={number === '01'}><summary><span className="day-num">{number}</span><strong>{title}</strong><ChevronDown size={18} /></summary><ol className="day-topics">{topics.map(topic => <li key={topic}>{topic}</li>)}</ol></details>)}</div></section>
  <section className="offer"><div className="offer-copy"><div className="section-kicker">/ Special offer</div><h2>Your next<br /><em>seven days</em><br />start here.</h2><p>One focused week to make the unfamiliar feel possible.</p></div><div className="offer-card"><span className="offer-tag">Limited seats · 100% online</span><small>JUST</small><Price dark /><div className="offer-rule" /><p>Includes all live sessions, project feedback, certificate of completion and community support.</p><button className="button button-navy" onClick={onEnroll}>Secure my seat <ArrowUpRight size={17} /></button></div></section>
  <section className="why section-pad"><div className="section-kicker">/ Why join</div><div className="why-grid"><h2>Make room<br /><span>for better questions.</span></h2><div className="benefits">{['Stay ahead with AI-powered design and research skills', 'Save time, increase creativity and productivity', 'Apply AI to real projects and research challenges', 'Learn from experts and connect with a like-minded community'].map((b, i) => <div key={b}><span>0{i + 1}</span><p>{b}</p></div>)}</div></div></section>
  <section className="final-cta"><p className="section-kicker">/ Begin the shift</p><h2>Transform the way you<br /><em>design & research</em> with AI.</h2><button className="button button-gold" onClick={onEnroll}>Enroll now <Price /></button></section>
 </main><footer><div className="footer-brand"><Logo /><p>Design education for a<br />more curious future.</p></div><div className="footer-contact"><span className="footer-label">Contact</span><a href="tel:+918530863658"><Phone size={15} />8530863658</a><a href="mailto:contact@reeghdesign.com"><Mail size={15} />contact@reeghdesign.com</a></div><div className="footer-social"><span className="footer-label">Find RéEGH</span><div className="social-links"><a href="https://www.instagram.com/reegh.co/" target="_blank" rel="noreferrer" aria-label="RéEGH on Instagram"><Instagram size={18} /></a><a href="https://www.facebook.com/p/Re%C3%A9gh-and-Company-61569432482418/" target="_blank" rel="noreferrer" aria-label="RéEGH on Facebook"><Facebook size={18} /></a><a href="https://www.reeghstudio.com/" target="_blank" rel="noreferrer" aria-label="RéEGH website"><Globe size={18} /></a></div><nav className="footer-legal"><a href="#top">Terms</a><a href="#top">Privacy</a><a href="#top">Refunds</a></nav></div><small>© 2026 RéEGH. All rights reserved.</small></footer><div className="mobile-cta"><button onClick={onEnroll}>Enroll now — ₹1,499/- <ArrowUpRight size={16} /></button></div></div>; }
function Field({ label, name, value, onChange, error, required = true, type = 'text' }: { label: string; name: keyof FormData; value: string; onChange: (k: keyof FormData, v: string) => void; error?: string; required?: boolean; type?: string }) { return <label className="field">{label}{required && <sup>*</sup>}<input type={type} value={value} onChange={e => onChange(name, e.target.value)} placeholder="Type here" />{error && <small>{error}</small>}</label>; }
function FlowPage({ flow, form, onChange, errors, onSubmit, onBack, onPay, paymentBusy, paymentError }: { flow: Flow; form: FormData; onChange: (k: keyof FormData, v: string | boolean) => void; errors: Partial<Record<keyof FormData, string>>; onSubmit: (e: React.FormEvent) => void; onBack: () => void; onPay: () => void; paymentBusy: boolean; paymentError: string }) { if (flow === 'success') return <div className="flow-shell"><Logo /><div className="success-box"><div className="success-icon"><Check /></div><p className="eyebrow">Payment successful</p><h1>You're officially<br /><em>registered.</em></h1><p>Your seat for the <strong>Design in Generative AI & Research in LLM</strong> 7-Day Intensive Workshop has been confirmed.</p><div className="receipt"><span>Participant name<strong>{form.fullName}</strong></span><span>Registration ID<strong>7D-{Math.floor(10000 + Math.random() * 89999)}</strong></span><span>Payment status<strong className="paid">PAID</strong></span></div><a className="button button-gold full" href="https://chat.whatsapp.com/KbbfA9MHHNi3FZnEsf4iTf" target="_blank" rel="noreferrer">Join WhatsApp workshop group <ArrowUpRight size={17} /></a><p className="fine-print">Please join the WhatsApp group to receive workshop schedule, meeting links, announcements and important updates.</p><button className="receipt-link">Download / view payment receipt</button></div></div>;
 if (flow === 'payment') return <div className="flow-shell"><Logo /><div className="payment-box"><button className="back" onClick={() => onBack()}>← Back to registration</button><p className="eyebrow">Secure checkout · Cashfree sandbox</p><h1>Complete your<br /><em>enrollment.</em></h1><div className="pay-summary"><span>Seven-day intensive workshop</span><strong><Price /></strong></div><div className="secure-line"><LockKeyhole size={16} /> Cashfree secure checkout · UPI · Cards · Net banking</div>{paymentError && <p className="payment-error">{paymentError}</p>}<button className="button button-navy full" onClick={onPay} disabled={paymentBusy}>{paymentBusy ? 'Opening Cashfree...' : 'Continue to Cashfree'} <ArrowUpRight size={17} /></button><p className="fine-print">Your payment is verified with Cashfree before registration is confirmed.</p></div></div>;
 return <div className="flow-shell"><Logo /><form className="registration-box" onSubmit={onSubmit}><button className="back" type="button" onClick={onBack}>← Back to workshop</button><p className="eyebrow">Reserve your place · 01 / 02</p><h1>Let's make<br /><em>something useful.</em></h1><p className="form-lead">Tell us a little about yourself. Your details are only used for workshop communication.</p><div className="form-grid"><Field label="Full name" name="fullName" value={form.fullName} onChange={onChange} error={errors.fullName} /><Field label="Email address" name="email" type="email" value={form.email} onChange={onChange} error={errors.email} /><Field label="WhatsApp number" name="whatsapp" value={form.whatsapp} onChange={onChange} error={errors.whatsapp} /><Field label="Profession" name="profession" value={form.profession} onChange={onChange} error={errors.profession} /><Field label="City" name="city" value={form.city} onChange={onChange} error={errors.city} /><label className="field">You are a<sup>*</sup><select value={form.participantType} onChange={e => onChange('participantType', e.target.value)}><option value="">Select one</option><option>Student</option><option>Professional</option></select>{errors.participantType && <small>{errors.participantType}</small>}</label><Field label="LinkedIn / Instagram" name="socialLink" value={form.socialLink} onChange={onChange} required={false} /></div><label className="consent"><input type="checkbox" checked={form.consent} onChange={e => onChange('consent', e.target.checked)} /><span>I agree to receive workshop-related communication on email and WhatsApp.</span></label>{errors.consent && <small className="consent-error">{errors.consent}</small>}<button className="button button-gold full" type="submit">Continue to payment <ArrowUpRight size={17} /></button><p className="fine-print">By continuing, you agree to our Terms, Privacy Policy and Refund / Cancellation Policy.</p></form></div>; }
export default App;
