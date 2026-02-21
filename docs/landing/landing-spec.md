# Spec: Landing page restructure — `public/landing.html`

## Context

This spec transforms the existing Finnon landing page from a feature-first narrative to a pain-first narrative. The target file is `public/landing.html`. All image paths (`/landing-images/...`) remain unchanged. The i18n system (ES/EN with `data-lang`, `.lang-btn`, `setLang()`) remains unchanged. The lightbox system remains unchanged.

Reference file: The final target HTML is attached separately as `landing-reference.html`. Use it as the source of truth for all copy, structure, and styles. This spec describes the delta from the current production file.

---

## Overview of changes

The page currently has 6 sections in this order:

1. Hero (L254–L280)
2. Problem section — dark bg (L282–L324)
3. Features — collaboration (L326–L364)
4. Showcase — personalization (L366–L404)
5. Onboarding steps (L406–L443)
6. CTA (L445–L474)

The new page has 7 sections in this order:

1. **Hero** — Pain headline + screenshot (replaces current hero)
2. **Empathy** — Dark bg, 3 quote cards (replaces current "problem" section)
3. **Solution** — Shared view, collaboration features + screenshots (replaces current "features" section)
4. **Depth** — Full product features + screenshots (replaces current "showcase" section)
5. **Steps** — Onboarding steps (kept, subtitle changed)
6. **FAQ** — New section, 3 accordion items
7. **CTA** — New copy

---

## Change 1: CSS — Add variable, replace/add styles

### 1a. Add CSS variable

In `:root` (L11–L18), add after `--grey-light`:

```css
--text-muted: #6B6B68;
```

### 1b. Replace hero styles

Replace L70–L95 (from `/* HERO */` through `.screen-wrap.side:hover`) with:

```css
/* HERO */
.hero { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 130px 24px 80px; text-align: center; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: radial-gradient(ellipse, rgba(91,141,255,0.10) 0%, transparent 70%); pointer-events: none; }
.hero h1 { font-family: 'DM Serif Display', serif; font-size: clamp(40px, 6.5vw, 72px); line-height: 1.08; letter-spacing: -1px; max-width: 820px; animation: fadeUp 0.6s ease both; }
.hero h1 em { font-style: italic; color: var(--blue); }
.hero-sub { margin-top: 24px; font-size: clamp(16px, 2vw, 19px); color: var(--text-muted); max-width: 580px; line-height: 1.65; font-weight: 400; animation: fadeUp 0.6s 0.12s ease both; }
.hero-actions { display: flex; gap: 12px; margin-top: 40px; flex-wrap: wrap; justify-content: center; animation: fadeUp 0.6s 0.24s ease both; }
.hero-screenshot { margin-top: 64px; animation: fadeUp 0.8s 0.36s ease both; }
.hero-screenshot .screen-pair img { width: min(340px, 72vw); border-radius: 28px; box-shadow: 0 32px 80px rgba(0,0,0,0.18); }
```

Keep `.btn-primary`, `.btn-secondary`, `.btn-disabled`, `.btn-android-icon` unchanged (L79–L84).

### 1c. Delete unused styles

Delete L86–L95 entirely (`.hero-screens`, `.screen-wrap`, `.screen-wrap.main`, `body.lang-en .screen-wrap`, `.screen-wrap.side`).

### 1d. Replace "problem" styles (L102–L115)

Replace from `/* PROBLEM */` through `.problem-screen .screen-wrap img` with:

```css
/* EMPATHY */
.empathy { padding: 100px 24px; background: var(--dark); color: #fff; }
.empathy .container { max-width: 800px; margin: 0 auto; text-align: center; }
.empathy h2 { font-family: 'DM Serif Display', serif; font-size: clamp(28px, 4vw, 42px); line-height: 1.2; margin-bottom: 48px; }
.empathy-cards { display: grid; grid-template-columns: 1fr; gap: 16px; text-align: left; }
.empathy-card { padding: 24px 28px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.04); transition: background 0.2s; }
.empathy-card:hover { background: rgba(255,255,255,0.07); }
.empathy-card p { font-size: 17px; line-height: 1.55; color: rgba(255,255,255,0.82); }
.empathy-card .quote-mark { font-family: 'DM Serif Display', serif; font-size: 32px; color: var(--blue); line-height: 1; margin-bottom: 8px; display: block; }
```

### 1e. Replace features/showcase styles (L117–L143)

Replace from `/* FEATURES */` through `.scroll-item:hover` with:

```css
/* SOLUTION */
.solution { padding: 100px 24px; }
.solution .container { max-width: 1100px; margin: 0 auto; }
.solution-header { max-width: 680px; margin-bottom: 48px; }
.solution-header h2 { font-family: 'DM Serif Display', serif; font-size: clamp(30px, 4vw, 46px); line-height: 1.15; margin-bottom: 16px; }
.solution-header p { font-size: 18px; line-height: 1.65; color: var(--text-muted); max-width: 600px; }
.solution-benefits { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--grey-light); border: 1px solid var(--grey-light); border-radius: 20px; overflow: hidden; margin-bottom: 40px; }
.solution-benefit { padding: 28px 24px; background: #fff; transition: background 0.2s; }
.solution-benefit:hover { background: #f9f9f7; }
.solution-benefit-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: var(--blue-deep); }
.solution-benefit-icon svg { width: 22px; height: 22px; stroke-width: 1.5; }
.solution-benefit h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; letter-spacing: -0.2px; }
.solution-benefit p { font-size: 14px; color: #666; line-height: 1.6; }
.solution-screens { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
.solution-screens .screen-pair img { width: 100%; max-width: 340px; margin: 0 auto; border-radius: 24px; box-shadow: 0 22px 60px rgba(0,0,0,0.14); display: none; }
body.lang-en .solution-screens .screen-pair img.en { display: block; }
body.lang-es .solution-screens .screen-pair img.es { display: block; }

/* DEPTH */
.depth { padding: 100px 24px; background: #f3f3f0; }
.depth .container { max-width: 1100px; margin: 0 auto; }
.depth-header { text-align: center; max-width: 680px; margin: 0 auto 48px; }
.depth-header h2 { font-family: 'DM Serif Display', serif; font-size: clamp(30px, 4vw, 44px); line-height: 1.15; margin-bottom: 12px; }
.depth-header p { font-size: 18px; line-height: 1.65; color: var(--text-muted); }
.depth-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: var(--grey-light); border: 1px solid var(--grey-light); border-radius: 20px; overflow: hidden; margin-bottom: 40px; }
.depth-card { padding: 28px 24px; background: #fff; transition: background 0.2s; }
.depth-card:hover { background: #f9f9f7; }
.depth-card-icon { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: var(--blue-deep); }
.depth-card-icon svg { width: 22px; height: 22px; stroke-width: 1.5; }
.depth-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; letter-spacing: -0.2px; }
.depth-card p { font-size: 14px; color: #666; line-height: 1.6; }
.depth-screens { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; align-items: start; }
.depth-screens .screen-pair img { width: 100%; max-width: 340px; margin: 0 auto; border-radius: 24px; box-shadow: 0 22px 60px rgba(0,0,0,0.14); display: none; }
body.lang-en .depth-screens .screen-pair img.en { display: block; }
body.lang-es .depth-screens .screen-pair img.es { display: block; }
```

### 1f. Add FAQ styles

Insert before the `/* CTA */` comment (L191):

```css
/* FAQ */
.faq { padding: 100px 24px; background: #f3f3f0; }
.faq .container { max-width: 720px; margin: 0 auto; }
.faq-header { text-align: center; margin-bottom: 48px; }
.faq-header h2 { font-family: 'DM Serif Display', serif; font-size: clamp(28px, 4vw, 40px); line-height: 1.15; }
.faq-list { display: grid; gap: 0; }
.faq-item { border-bottom: 1px solid rgba(0,0,0,0.08); }
.faq-item:first-child { border-top: 1px solid rgba(0,0,0,0.08); }
.faq-question { width: 100%; background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 16px; font-weight: 600; text-align: left; padding: 22px 0; cursor: pointer; color: var(--dark); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.faq-question:hover { color: var(--blue-deep); }
.faq-icon { width: 20px; height: 20px; flex-shrink: 0; transition: transform 0.25s ease; }
.faq-item.open .faq-icon { transform: rotate(45deg); }
.faq-answer { max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; }
.faq-item.open .faq-answer { max-height: 200px; }
.faq-answer p { padding: 0 0 22px; font-size: 15px; line-height: 1.65; color: var(--text-muted); }
```

### 1g. Add nav-cta styles

Insert after `.nav-right` (L67):

```css
.nav-cta { font-family: 'DM Sans', sans-serif; background: var(--dark); color: #fff; border: none; padding: 8px 18px; border-radius: 100px; font-size: 13px; font-weight: 500; cursor: pointer; text-decoration: none; transition: opacity 0.2s; }
.nav-cta:hover { opacity: 0.85; }
```

### 1h. Update responsive styles

Replace the `@media (max-width: 900px)` block (L217–L223) with:

```css
@media (max-width: 900px) {
  .solution-benefits { grid-template-columns: 1fr; }
  .solution-screens { gap: 14px; }
  .depth-grid { grid-template-columns: repeat(2, 1fr); }
  .depth-screens { gap: 14px; }
}
```

Replace the `@media (max-width: 768px)` block (L224–L235) with:

```css
@media (max-width: 768px) {
  nav { padding: 16px 20px; }
  .empathy-cards { gap: 12px; }
  .empathy-card { padding: 20px 22px; }
  .empathy-card p { font-size: 15px; }
  .solution-benefits { grid-template-columns: 1fr; }
  .solution-screens .screen-pair img,
  .depth-screens .screen-pair img { max-width: 100%; }
  .depth-grid { grid-template-columns: repeat(2, 1fr); }
  .steps-track::before { display: none; }
  .steps-track { flex-direction: column; gap: 32px; }
  .step { align-items: flex-start; text-align: left; flex-direction: row; gap: 16px; }
  .step-node { margin-bottom: 0; flex-shrink: 0; }
  footer { flex-direction: column; gap: 12px; text-align: center; }
}
```

Add a new breakpoint after the 768px block:

```css
@media (max-width: 480px) {
  .hero { padding: 110px 20px 60px; }
  .hero-screenshot .screen-pair img { width: 82vw; }
  .empathy { padding: 72px 20px; }
  .solution { padding: 72px 20px; }
  .depth { padding: 72px 20px; }
  .steps-section { padding: 72px 20px; }
  .faq { padding: 72px 20px; }
  .cta-section { padding: 72px 20px; }
}
```

### 1i. Delete unused styles

Delete these style blocks entirely (they are no longer referenced):
- `.section-sub` (L100)
- `.showcase`, `.showcase-title`, `.showcase .section-sub`, `.showcase .screens-scroll` (L132–L136)
- `.screens-scroll` and scrollbar styles (L137–L140)
- `.scroll-item` styles (L141–L143)
- `.hero-badge` and `.hero-badge .dot` (L72–L73)
- `.problem-*` styles (all of L102–L115)
- `.features-grid`, `.feature-card`, `.feature-icon` (L117–L124)
- `.proof-grid`, `.proof-grid-mobile-duo`, `.proof-item` (L125–L130)
- `.steps-breadcrumb` (L183)

---

## Change 2: Nav — Add CTA button

Replace L240–L251 (the entire `<nav>...</nav>`) with:

```html
<nav>
  <a href="#" class="nav-logo">
    <img src="/landing-images/nav-logo.jpg" alt="Finnon">
    Finnon
  </a>
  <div class="nav-right">
    <div class="lang-toggle">
      <button class="lang-btn active" onclick="setLang('en')">EN</button>
      <button class="lang-btn" onclick="setLang('es')">ES</button>
    </div>
    <a href="/login" class="nav-cta">
      <span data-lang="en">Open app</span>
      <span data-lang="es">Abrir app</span>
    </a>
  </div>
</nav>
```

---

## Change 3: Hero section

Replace L253–L280 (from `<!-- HERO -->` through `</section>`) with:

```html
<!-- HERO -->
<section class="hero">
  <h1>
    <span data-lang="en">You carry the finances.<br>Your partner goes <em>blind.</em></span>
    <span data-lang="es">Tú llevas las cuentas.<br>Tu pareja va <em>a ciegas.</em></span>
  </h1>
  <p class="hero-sub">
    <span data-lang="en">One of you tracks every euro. The other has no idea where you stand. Finnon gives you both the same complete picture — so nobody has to guess.</span>
    <span data-lang="es">Uno de los dos controla cada euro. El otro no sabe ni cómo vais. Finnon os da a los dos la misma foto completa — para que nadie tenga que adivinar.</span>
  </p>
  <div class="hero-actions">
    <a href="/login" class="btn-primary">
      <i data-lucide="monitor"></i>
      <span data-lang="en">Start now</span>
      <span data-lang="es">Empezar</span>
    </a>
    <span class="btn-secondary btn-disabled">
      <svg class="btn-android-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#34A853" d="M3.6 2.2c-.3.3-.5.7-.5 1.2v17.2c0 .5.2.9.5 1.2l9.6-9.8L3.6 2.2z"/>
        <path fill="#FBBC04" d="M16.4 14.7l-3.2-3.2-9.6 9.8c.4.4 1 .5 1.6.1l11.2-6.7z"/>
        <path fill="#EA4335" d="M16.5 9.4L5.2 2.6c-.6-.4-1.2-.2-1.6.1l9.6 9.8 3.3-3.1z"/>
        <path fill="#4285F4" d="M20.4 11.2l-3.9-2.3-3.4 3.2 3.3 3.3 4-2.4c.9-.5.9-1.4 0-1.8z"/>
      </svg>
      <span data-lang="en">Android — Coming soon</span>
      <span data-lang="es">Android — Próximamente</span>
    </span>
  </div>
  <div class="hero-screenshot">
    <div class="screen-pair">
      <img class="en zoomable-image" src="/landing-images/collab-right-02_en.png" alt="Finnon shared dashboard">
      <img class="es zoomable-image" src="/landing-images/collab-right-02.png" alt="Dashboard compartido de Finnon">
    </div>
  </div>
</section>
```

---

## Change 4: Replace "Problem" section with "Empathy"

Replace L282–L324 (from `<!-- PROBLEM -->` through its closing `</section>`) with:

```html
<!-- EMPATHY -->
<section class="empathy">
  <div class="container">
    <h2>
      <span data-lang="en">Sound familiar?</span>
      <span data-lang="es">¿Te suena?</span>
    </h2>
    <div class="empathy-cards">
      <div class="empathy-card">
        <span class="quote-mark">"</span>
        <p>
          <span data-lang="en">I manage the spreadsheet, the bills, the accounts. My partner just asks "can we afford it?" and waits for my answer.</span>
          <span data-lang="es">Yo llevo la hoja de cálculo, las facturas, las cuentas. Mi pareja solo pregunta "¿nos lo podemos permitir?" y espera mi respuesta.</span>
        </p>
      </div>
      <div class="empathy-card">
        <span class="quote-mark">"</span>
        <p>
          <span data-lang="en">I know we should track our money together, but every time I look at numbers I feel lost. It's easier to just not look.</span>
          <span data-lang="es">Sé que deberíamos llevar las cuentas juntos, pero cada vez que veo números me pierdo. Es más fácil no mirar.</span>
        </p>
      </div>
      <div class="empathy-card">
        <span class="quote-mark">"</span>
        <p>
          <span data-lang="en">We've tried shared spreadsheets. I'm the only one who updates them. At some point, I just stopped explaining.</span>
          <span data-lang="es">Hemos probado hojas de cálculo compartidas. Soy el único que las actualiza. En algún momento, dejé de explicar.</span>
        </p>
      </div>
    </div>
  </div>
</section>
```

---

## Change 5: Replace "Features" section with "Solution"

Replace L326–L364 (from `<!-- FEATURES -->` through its closing `</section>`) with:

```html
<!-- SOLUTION -->
<section class="solution">
  <div class="container">
    <div class="solution-header">
      <h2>
        <span data-lang="en">One view. Both of you.<br>No translation needed.</span>
        <span data-lang="es">Una vista. Los dos.<br>Sin necesidad de traducir.</span>
      </h2>
      <p>
        <span data-lang="en">Finnon gives both of you the same picture — who pays what, how much each contributes, and where the money goes. One stops carrying the weight alone. The other stops flying blind.</span>
        <span data-lang="es">Finnon os da a los dos la misma foto — quién paga qué, cuánto aporta cada uno y a dónde va el dinero. Uno deja de cargar solo con el peso. El otro deja de ir a ciegas.</span>
      </p>
    </div>
    <div class="solution-benefits">
      <div class="solution-benefit">
        <div class="solution-benefit-icon"><i data-lucide="trending-up"></i></div>
        <h3><span data-lang="en">Who pays what</span><span data-lang="es">Quién paga qué</span></h3>
        <p><span data-lang="en">See each person's contributions by category. No guessing, no arguments.</span><span data-lang="es">Visualiza las contribuciones de cada uno por categoría. Sin suposiciones, sin discusiones.</span></p>
      </div>
      <div class="solution-benefit">
        <div class="solution-benefit-icon"><i data-lucide="users"></i></div>
        <h3><span data-lang="en">The same picture, both of you</span><span data-lang="es">La misma foto, los dos</span></h3>
        <p><span data-lang="en">Your partner sees exactly what you see. The questions answer themselves.</span><span data-lang="es">Tu pareja ve exactamente lo mismo que tú. Las preguntas se responden solas.</span></p>
      </div>
    </div>
    <div class="solution-screens">
      <div class="screen-pair">
        <img class="en zoomable-image" src="/landing-images/collab-left-02_en.png" alt="Contribution detail">
        <img class="es zoomable-image" src="/landing-images/collab-left-02.png" alt="Detalle de contribuciones">
      </div>
      <div class="screen-pair">
        <img class="en zoomable-image" src="/landing-images/collab-right-02_en.png" alt="Shared expenses by category">
        <img class="es zoomable-image" src="/landing-images/collab-right-02.png" alt="Gastos compartidos por categoría">
      </div>
    </div>
  </div>
</section>
```

---

## Change 6: Replace "Showcase" section with "Depth"

Replace L366–L404 (from `<!-- SHOWCASE -->` through its closing `</section>`) with:

```html
<!-- DEPTH -->
<section class="depth">
  <div class="container">
    <div class="depth-header">
      <h2>
        <span data-lang="en">Everything else you need<br>to see clearly</span>
        <span data-lang="es">Todo lo demás que necesitas<br>para ver con claridad</span>
      </h2>
      <p>
        <span data-lang="en">Beyond shared visibility, Finnon gives you the tools to understand your complete financial picture.</span>
        <span data-lang="es">Más allá de la visibilidad compartida, Finnon te da las herramientas para entender tu panorama financiero completo.</span>
      </p>
    </div>
    <div class="depth-grid">
      <div class="depth-card">
        <div class="depth-card-icon"><i data-lucide="layers"></i></div>
        <h3><span data-lang="en">Multiple accounts, one view</span><span data-lang="es">Múltiples cuentas, una vista</span></h3>
        <p><span data-lang="en">Bring all your accounts together in one place. Your complete money, at a glance.</span><span data-lang="es">Reúne todas tus cuentas en un solo lugar. Tu dinero completo, de un vistazo.</span></p>
      </div>
      <div class="depth-card">
        <div class="depth-card-icon"><i data-lucide="banknote"></i></div>
        <h3><span data-lang="en">Cash counts too</span><span data-lang="es">El efectivo también cuenta</span></h3>
        <p><span data-lang="en">Track what you pay in cash and keep the full picture of your day-to-day.</span><span data-lang="es">Registra lo que pagas en efectivo y mantén la foto completa de tu día a día.</span></p>
      </div>
      <div class="depth-card">
        <div class="depth-card-icon"><i data-lucide="tag"></i></div>
        <h3><span data-lang="en">Your categories, your language</span><span data-lang="es">Tus categorías, tu lenguaje</span></h3>
        <p><span data-lang="en">Use the built-in categories or create your own. Your money, your rules.</span><span data-lang="es">Usa las categorías de serie o crea las tuyas. Tu dinero, tus reglas.</span></p>
      </div>
      <div class="depth-card">
        <div class="depth-card-icon"><i data-lucide="target"></i></div>
        <h3><span data-lang="en">Goals, not budgets</span><span data-lang="es">Objetivos, no presupuestos</span></h3>
        <p><span data-lang="en">We don't tell you where to spend less. We show you how far you are from what excites you.</span><span data-lang="es">No te decimos en qué gastar menos. Te mostramos cuánto falta para eso que os hace ilusión.</span></p>
      </div>
    </div>
    <div class="depth-screens">
      <div class="screen-pair">
        <img class="en zoomable-image" src="/landing-images/personal-left-08_en.png" alt="Custom categories">
        <img class="es zoomable-image" src="/landing-images/personal-left-08.png" alt="Categorías personalizadas">
      </div>
      <div class="screen-pair">
        <img class="en zoomable-image" src="/landing-images/personal-right-05_en.png" alt="Savings goal tracker">
        <img class="es zoomable-image" src="/landing-images/personal-right-05.png" alt="Seguimiento de objetivo de ahorro">
      </div>
    </div>
  </div>
</section>
```

---

## Change 7: Update steps section subtitle

Replace L406–L443 (from `<!-- ONBOARDING STEPS -->` through its closing `</section>`) with:

```html
<!-- STEPS -->
<section class="steps-section">
  <div class="container">
    <div style="text-align:center; margin-bottom:56px;">
      <h2 style="font-family:'DM Serif Display',serif; font-size:clamp(30px,4vw,44px); line-height:1.15; margin-bottom:10px;">
        <span data-lang="en">Up and running in minutes</span>
        <span data-lang="es">Funcionando en minutos</span>
      </h2>
      <p style="color:#6B6B68; font-size:17px;">
        <span data-lang="en">Create your account, invite your partner, and start seeing your money together.</span>
        <span data-lang="es">Crea tu cuenta, invita a tu pareja y empezad a ver vuestro dinero juntos.</span>
      </p>
    </div>
    <div class="steps-track">
      <div class="step">
        <div class="step-node">1</div>
        <div>
          <h3><span data-lang="en">Create your account</span><span data-lang="es">Crea tu cuenta</span></h3>
          <p><span data-lang="en">Sign up in seconds and set your base account.</span><span data-lang="es">Regístrate en segundos y crea tu cuenta base.</span></p>
        </div>
      </div>
      <div class="step">
        <div class="step-node">2</div>
        <div>
          <h3><span data-lang="en">Invite your partner</span><span data-lang="es">Invita a tu pareja</span></h3>
          <p><span data-lang="en">Share access so both of you see the same picture.</span><span data-lang="es">Comparte acceso para que los dos veáis la misma foto.</span></p>
        </div>
      </div>
      <div class="step">
        <div class="step-node">3</div>
        <div>
          <h3><span data-lang="en">Start logging</span><span data-lang="es">Empieza a registrar</span></h3>
          <p><span data-lang="en">Add your transactions and you're set.</span><span data-lang="es">Añade tus movimientos y listo.</span></p>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Change 8: Add FAQ section

Insert the following **between** the steps `</section>` and `<!-- CTA -->`:

```html
<!-- FAQ -->
<section class="faq">
  <div class="container">
    <div class="faq-header">
      <h2>
        <span data-lang="en">Common questions</span>
        <span data-lang="es">Preguntas frecuentes</span>
      </h2>
    </div>
    <div class="faq-list">
      <div class="faq-item">
        <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
          <span>
            <span data-lang="en">Does it connect to my bank?</span>
            <span data-lang="es">¿Se conecta con mi banco?</span>
          </span>
          <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="faq-answer">
          <p>
            <span data-lang="en">No. Finnon uses manual entry — you log your transactions yourself. This means no bank credentials, no third-party access to your accounts, and no security concerns.</span>
            <span data-lang="es">No. Finnon funciona con entrada manual — tú registras tus movimientos. Esto significa que no necesitas compartir credenciales bancarias, nadie accede a tus cuentas y no hay riesgos de seguridad.</span>
          </p>
        </div>
      </div>
      <div class="faq-item">
        <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
          <span>
            <span data-lang="en">How many people can share an account?</span>
            <span data-lang="es">¿Cuántas personas pueden compartir una cuenta?</span>
          </span>
          <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="faq-answer">
          <p>
            <span data-lang="en">Right now, up to 2 people per account — perfect for couples or roommates. We're working on support for more members in the future.</span>
            <span data-lang="es">Ahora mismo, hasta 2 personas por cuenta — perfecto para parejas o compañeros de piso. Estamos trabajando en ampliar a más miembros en el futuro.</span>
          </p>
        </div>
      </div>
      <div class="faq-item">
        <button class="faq-question" onclick="this.parentElement.classList.toggle('open')">
          <span>
            <span data-lang="en">Can I use it on my own, without a partner?</span>
            <span data-lang="es">¿Puedo usarla solo, sin pareja?</span>
          </span>
          <svg class="faq-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <div class="faq-answer">
          <p>
            <span data-lang="en">Absolutely. Finnon works just as well for one person. You get the same complete view of your accounts, cash, categories and goals — and you can always invite someone later.</span>
            <span data-lang="es">Por supuesto. Finnon funciona igual de bien para una persona. Tienes la misma vista completa de tus cuentas, efectivo, categorías y objetivos — y siempre puedes invitar a alguien más adelante.</span>
          </p>
        </div>
      </div>
    </div>
  </div>
</section>
```

---

## Change 9: Replace CTA section

Replace L445–L474 (from `<!-- CTA -->` through its closing `</section>`) with:

```html
<!-- CTA -->
<section class="cta-section">
  <div class="container">
    <h2>
      <span data-lang="en">Stop explaining.<br>Start <em>sharing.</em></span>
      <span data-lang="es">Deja de explicar.<br>Empieza a <em>compartir.</em></span>
    </h2>
    <p>
      <span data-lang="en">Available on web and mobile. Up and running in minutes.</span>
      <span data-lang="es">Disponible en web y móvil. Funcionando en minutos.</span>
    </p>
    <div class="cta-actions">
      <a href="/login" class="cta-button">
        <i data-lucide="monitor"></i>
        <span data-lang="en">Start now</span>
        <span data-lang="es">Empezar</span>
      </a>
      <span class="cta-button secondary btn-disabled">
        <svg class="btn-android-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#34A853" d="M3.6 2.2c-.3.3-.5.7-.5 1.2v17.2c0 .5.2.9.5 1.2l9.6-9.8L3.6 2.2z"/>
          <path fill="#FBBC04" d="M16.4 14.7l-3.2-3.2-9.6 9.8c.4.4 1 .5 1.6.1l11.2-6.7z"/>
          <path fill="#EA4335" d="M16.5 9.4L5.2 2.6c-.6-.4-1.2-.2-1.6.1l9.6 9.8 3.3-3.1z"/>
          <path fill="#4285F4" d="M20.4 11.2l-3.9-2.3-3.4 3.2 3.3 3.3 4-2.4c.9-.5.9-1.4 0-1.8z"/>
        </svg>
        <span data-lang="en">Android — Coming soon</span>
        <span data-lang="es">Android — Próximamente</span>
      </span>
    </div>
  </div>
</section>
```

---

## Change 10: Update footer email

Replace L481 (the Cloudflare-obfuscated email link) with:

```html
<a href="mailto:hello@finnon.app">hello@finnon.app</a>
```

---

## Change 11: Simplify JavaScript

Replace the entire `<script>` block (L496–end) with:

```html
<script>
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  function setLang(lang) {
    var safeLang = lang === 'es' ? 'es' : 'en';
    document.body.className = 'lang-' + safeLang;
    document.querySelectorAll('.lang-btn').forEach(function(b) {
      b.classList.toggle('active', b.textContent === safeLang.toUpperCase());
    });
    localStorage.setItem('finnon-lang', safeLang);
    document.cookie = 'NEXT_LOCALE=' + safeLang + '; path=/; max-age=31536000; SameSite=Lax';
  }

  // Lightbox
  var lightbox = document.getElementById('image-lightbox');
  var lightboxImage = lightbox ? lightbox.querySelector('.lightbox-image') : null;
  var lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
  var previousBodyOverflow = '';

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImage || !src) return;
    lightboxImage.src = src;
    lightboxImage.alt = alt || 'Screenshot';
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.src = '';
    document.body.style.overflow = previousBodyOverflow;
  }

  if (lightbox) {
    lightbox.addEventListener('click', function(event) {
      if (event.target === lightbox) closeLightbox();
    });
  }
  if (lightboxClose) {
    lightboxClose.addEventListener('click', closeLightbox);
  }
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && lightbox && !lightbox.hidden) closeLightbox();
  });

  // Image zoom
  document.querySelectorAll('.zoomable-image').forEach(function(image) {
    image.addEventListener('click', function() {
      openLightbox(image.currentSrc || image.src, image.alt);
    });
  });

  // Auto-detect language
  (function() {
    var saved = localStorage.getItem('finnon-lang');
    if (saved) { setLang(saved); return; }
    var browserLang = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
    setLang(browserLang === 'es' ? 'es' : 'en');
  })();
</script>
```

Key changes: removed `renderMobileProof`, `populateMobileProofSections`, and `enableImageZoom` functions (no longer needed — zoom is now bound directly to `.zoomable-image` elements). Removed Cloudflare email decode script reference.

---

## What stays unchanged

- All image paths in `/landing-images/`
- The lightbox HTML (`#image-lightbox`)
- The FoundrList promo badge
- The footer structure (except email link)
- The `lang-toggle` system and `setLang()` logic
- All CSS variables except the new `--text-muted`

---

## Verification checklist

After applying changes:

1. Page loads without console errors
2. EN/ES toggle works on all sections including new FAQ
3. All 3 FAQ items open/close independently (+ icon rotates to ×)
4. All screenshots display correctly for both languages
5. Lightbox works on all zoomable images (hero screenshot, solution screens, depth screens)
6. Nav CTA button ("Open app" / "Abrir app") links to `/login`
7. Responsive: at 768px, steps go vertical, footer stacks
8. Responsive: at 480px, padding reduces on all sections
9. No references to old classes: `.problem`, `.features-grid`, `.feature-card`, `.showcase`, `.proof-grid`, `.hero-screens`, `.screen-wrap`, `.hero-badge`
