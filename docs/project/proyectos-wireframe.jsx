import { useState, useMemo } from "react";

const COLORS = {
  bg: "#1A1A1A",
  bgCard: "#242424",
  bgCardHover: "#2A2A2A",
  bgInput: "#1E1E1E",
  primary: "#5B8DFF",
  primaryDim: "rgba(91,141,255,0.15)",
  accent: "#4AEAB1",
  accentDim: "rgba(74,234,177,0.12)",
  accentWarm: "#FFB74D",
  accentWarmDim: "rgba(255,183,77,0.12)",
  danger: "#FF6B6B",
  dangerDim: "rgba(255,107,107,0.12)",
  text: "#FAFAF8",
  textMuted: "#9E9E9E",
  textDim: "#666",
  border: "#333",
  borderLight: "#3A3A3A",
};

const MOCK_EXPENSES = [
  { id: 1, name: "Netflix", amount: 17.99, category: "Ocio", active: true },
  { id: 2, name: "Spotify", amount: 10.99, category: "Ocio", active: true },
  { id: 3, name: "Gimnasio", amount: 39.99, category: "Salud", active: true },
  { id: 4, name: "Restaurantes", amount: 180, category: "Comida", active: true },
  { id: 5, name: "Cafés", amount: 45, category: "Comida", active: true },
  { id: 6, name: "Suscripción Cloud", amount: 9.99, category: "Tech", active: true },
  { id: 7, name: "Ropa", amount: 75, category: "Personal", active: true },
];

const MOCK_PROJECTS = [
  {
    id: 1,
    name: "Eurodisney",
    emoji: "🏰",
    target: 6000,
    saved: 1850,
    monthlyCommitment: 350,
    createdAt: "2025-11-01",
  },
  {
    id: 2,
    name: "Portátil nuevo",
    emoji: "💻",
    target: 1500,
    saved: 600,
    monthlyCommitment: 200,
    createdAt: "2025-12-01",
  },
  {
    id: 3,
    name: "Reforma cocina",
    emoji: "🍳",
    target: 12000,
    saved: 3200,
    monthlyCommitment: 0,
    createdAt: "2025-10-01",
  },
];

function formatCurrency(n) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatMonths(months) {
  if (months <= 0) return "¡Ya lo tienes!";
  const y = Math.floor(months / 12);
  const m = Math.ceil(months % 12);
  if (y > 0 && m > 0) return `${y} año${y > 1 ? "s" : ""} y ${m} mes${m > 1 ? "es" : ""}`;
  if (y > 0) return `${y} año${y > 1 ? "s" : ""}`;
  return `${m} mes${m > 1 ? "es" : ""}`;
}

function getEstimatedDate(months) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function ProgressRing({ progress, size = 80, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.min(progress, 1) * circumference;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={COLORS.border} strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={radius} fill="none"
        stroke={progress >= 1 ? COLORS.accent : COLORS.primary}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function ProjectCard({ project, onClick }) {
  const progress = project.saved / project.target;
  const remaining = project.target - project.saved;
  const monthsLeft = project.monthlyCommitment > 0 ? remaining / project.monthlyCommitment : null;

  return (
    <div
      onClick={onClick}
      style={{
        background: COLORS.bgCard, borderRadius: 16, padding: "24px",
        cursor: "pointer", transition: "all 0.2s ease",
        border: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", gap: 20,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = COLORS.bgCardHover; e.currentTarget.style.borderColor = COLORS.borderLight; }}
      onMouseLeave={e => { e.currentTarget.style.background = COLORS.bgCard; e.currentTarget.style.borderColor = COLORS.border; }}
    >
      <div style={{ position: "relative", flexShrink: 0 }}>
        <ProgressRing progress={progress} />
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 28,
        }}>
          {project.emoji}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
            {project.name}
          </h3>
          <span style={{ fontSize: 14, color: COLORS.textMuted, flexShrink: 0, marginLeft: 12 }}>
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 15, color: COLORS.textMuted }}>
            {formatCurrency(project.saved)} <span style={{ color: COLORS.textDim }}>de</span> {formatCurrency(project.target)}
          </span>
          {monthsLeft !== null && monthsLeft > 0 ? (
            <span style={{ fontSize: 13, color: COLORS.accent }}>
              {getEstimatedDate(monthsLeft)}
            </span>
          ) : project.monthlyCommitment === 0 ? (
            <span style={{ fontSize: 13, color: COLORS.accentWarm }}>Sin plan de ahorro</span>
          ) : null}
        </div>
      </div>

      <div style={{ color: COLORS.textDim, fontSize: 20, flexShrink: 0 }}>›</div>
    </div>
  );
}

function ProjectListView({ projects, onSelect, onNew }) {
  const totalCommitment = projects.reduce((s, p) => s + p.monthlyCommitment, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
          Proyectos
        </h1>
        <button
          onClick={onNew}
          style={{
            background: COLORS.primary, color: "#fff", border: "none", borderRadius: 10,
            padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          + Nuevo proyecto
        </button>
      </div>

      {totalCommitment > 0 && (
        <div style={{
          background: COLORS.primaryDim, borderRadius: 12, padding: "16px 20px",
          marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center",
          border: `1px solid rgba(91,141,255,0.2)`,
        }}>
          <span style={{ fontSize: 14, color: COLORS.textMuted }}>Compromiso mensual total</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: COLORS.primary, fontFamily: "'DM Sans', sans-serif" }}>
            {formatCurrency(totalCommitment)}/mes
          </span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} onClick={() => onSelect(p)} />
        ))}
      </div>
    </div>
  );
}

function SimulatorSlider({ value, onChange, max, label, sublabel }) {
  const pct = (value / max) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 14, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontSize: 18, fontWeight: 700, color: COLORS.primary, fontFamily: "'DM Sans', sans-serif" }}>
          {formatCurrency(value)}<span style={{ fontSize: 13, fontWeight: 400, color: COLORS.textMuted }}>/mes</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 36, display: "flex", alignItems: "center" }}>
        <div style={{
          position: "absolute", left: 0, right: 0, height: 6, borderRadius: 3,
          background: COLORS.bgInput,
        }} />
        <div style={{
          position: "absolute", left: 0, width: `${pct}%`, height: 6, borderRadius: 3,
          background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
          transition: "width 0.15s ease",
        }} />
        <input
          type="range" min={0} max={max} step={25} value={value} onChange={e => onChange(+e.target.value)}
          style={{
            position: "absolute", width: "100%", height: 36, opacity: 0, cursor: "pointer", margin: 0,
          }}
        />
        <div style={{
          position: "absolute", left: `${pct}%`, transform: "translateX(-50%)",
          width: 22, height: 22, borderRadius: "50%", background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)", pointerEvents: "none",
          transition: "left 0.15s ease",
        }} />
      </div>
      {sublabel && <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>{sublabel}</div>}
    </div>
  );
}

function ExpenseToggle({ expense, onToggle }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 0", borderBottom: `1px solid ${COLORS.border}`,
    }}>
      <div>
        <div style={{ fontSize: 14, color: expense.active ? COLORS.textMuted : COLORS.text, fontWeight: expense.active ? 400 : 600 }}>
          {expense.name}
          {!expense.active && <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>DESACTIVADO</span>}
        </div>
        <div style={{ fontSize: 12, color: COLORS.textDim }}>{expense.category}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{
          fontSize: 14, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
          color: expense.active ? COLORS.textMuted : COLORS.accent,
          textDecoration: expense.active ? "none" : "none",
        }}>
          {formatCurrency(expense.amount)}
        </span>
        <div
          onClick={onToggle}
          style={{
            width: 44, height: 24, borderRadius: 12, cursor: "pointer",
            background: expense.active ? COLORS.border : COLORS.accent,
            position: "relative", transition: "background 0.2s ease",
          }}
        >
          <div style={{
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            position: "absolute", top: 3,
            left: expense.active ? 3 : 23,
            transition: "left 0.2s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function ProjectDetailView({ project, onBack }) {
  const [sliderValue, setSliderValue] = useState(project.monthlyCommitment || 200);
  const [expenses, setExpenses] = useState(MOCK_EXPENSES);
  const [showExpenses, setShowExpenses] = useState(false);
  const [activeTab, setActiveTab] = useState("simulador");

  const savedFromExpenses = expenses.filter(e => !e.active).reduce((s, e) => s + e.amount, 0);
  const effectiveMonthly = sliderValue + savedFromExpenses;
  const remaining = project.target - project.saved;
  const monthsLeft = effectiveMonthly > 0 ? remaining / effectiveMonthly : Infinity;
  const progress = project.saved / project.target;

  const milestones = [
    { pct: 0.25, label: "25%", amount: project.target * 0.25 },
    { pct: 0.50, label: "50%", amount: project.target * 0.50 },
    { pct: 0.75, label: "75%", amount: project.target * 0.75 },
    { pct: 1.00, label: "100%", amount: project.target },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 8,
            color: COLORS.textMuted, fontSize: 18, cursor: "pointer", width: 36, height: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ‹
        </button>
        <span style={{ fontSize: 32 }}>{project.emoji}</span>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
            {project.name}
          </h2>
          <span style={{ fontSize: 13, color: COLORS.textMuted }}>
            Creado en {new Date(project.createdAt).toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Hero: amount + date */}
      <div style={{
        background: COLORS.bgCard, borderRadius: 16, padding: "32px 28px",
        border: `1px solid ${COLORS.border}`, marginBottom: 20, textAlign: "center",
      }}>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
          Objetivo
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: COLORS.text, fontFamily: "'DM Sans', sans-serif", marginBottom: 4 }}>
          {formatCurrency(project.target)}
        </div>

        {/* Progress bar with milestones */}
        <div style={{ position: "relative", margin: "24px 0 32px" }}>
          <div style={{ height: 8, borderRadius: 4, background: COLORS.bgInput, position: "relative", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
              width: `${Math.min(progress * 100, 100)}%`,
              transition: "width 0.6s ease",
            }} />
          </div>
          {/* Milestone markers */}
          <div style={{ position: "relative", height: 24 }}>
            {milestones.map(m => (
              <div key={m.label} style={{
                position: "absolute", left: `${m.pct * 100}%`, transform: "translateX(-50%)",
                display: "flex", flexDirection: "column", alignItems: "center",
              }}>
                <div style={{
                  width: 2, height: 8, background: progress >= m.pct ? COLORS.accent : COLORS.textDim,
                  marginTop: -4, borderRadius: 1,
                }} />
                <span style={{
                  fontSize: 10, marginTop: 2,
                  color: progress >= m.pct ? COLORS.accent : COLORS.textDim,
                  fontWeight: progress >= m.pct ? 600 : 400,
                }}>
                  {m.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-around" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.accent, fontFamily: "'DM Sans', sans-serif" }}>
              {formatCurrency(project.saved)}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Ahorrado</div>
          </div>
          <div style={{ width: 1, background: COLORS.border }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
              {formatCurrency(remaining)}
            </div>
            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>Restante</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, background: COLORS.bgCard, borderRadius: 10, padding: 3 }}>
        {[
          { key: "simulador", label: "Simulador" },
          { key: "historial", label: "Historial" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "10px 0", fontSize: 14, fontWeight: 600, border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
              background: activeTab === tab.key ? COLORS.primary : "transparent",
              color: activeTab === tab.key ? "#fff" : COLORS.textMuted,
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "simulador" && (
        <>
          {/* Estimated date - hero result */}
          <div style={{
            background: effectiveMonthly > 0 ? COLORS.accentDim : COLORS.accentWarmDim,
            borderRadius: 14, padding: "24px",
            border: `1px solid ${effectiveMonthly > 0 ? "rgba(74,234,177,0.2)" : "rgba(255,183,77,0.2)"}`,
            marginBottom: 20, textAlign: "center",
          }}>
            {effectiveMonthly > 0 ? (
              <>
                <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 6 }}>
                  Con {formatCurrency(effectiveMonthly)}/mes llegas en
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.accent, fontFamily: "'DM Sans', sans-serif" }}>
                  {formatMonths(monthsLeft)}
                </div>
                <div style={{ fontSize: 15, color: COLORS.textMuted, marginTop: 6 }}>
                  📅 {getEstimatedDate(monthsLeft)}
                </div>
                {savedFromExpenses > 0 && (
                  <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 10, fontStyle: "italic" }}>
                    Incluye {formatCurrency(savedFromExpenses)}/mes de gastos desactivados
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, color: COLORS.accentWarm }}>
                  Mueve el slider para explorar cuándo llegarías
                </div>
              </>
            )}
          </div>

          {/* Simple slider */}
          <div style={{
            background: COLORS.bgCard, borderRadius: 14, padding: "24px",
            border: `1px solid ${COLORS.border}`, marginBottom: 12,
          }}>
            <SimulatorSlider
              value={sliderValue}
              onChange={setSliderValue}
              max={1500}
              label="Ahorro mensual"
              sublabel="Desliza para ver cómo cambia la fecha"
            />
          </div>

          {/* Expandable expense breakdown */}
          <div style={{
            background: COLORS.bgCard, borderRadius: 14,
            border: `1px solid ${COLORS.border}`, overflow: "hidden",
          }}>
            <div
              onClick={() => setShowExpenses(!showExpenses)}
              style={{
                padding: "18px 24px", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
                  ¿Qué gastos puedo recortar?
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                  Desactiva gastos para ver cómo acelerás tu proyecto
                </div>
              </div>
              <div style={{
                color: COLORS.textMuted, fontSize: 18,
                transform: showExpenses ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}>
                ▾
              </div>
            </div>

            {showExpenses && (
              <div style={{ padding: "0 24px 20px" }}>
                {savedFromExpenses > 0 && (
                  <div style={{
                    background: COLORS.accentDim, borderRadius: 8, padding: "10px 14px",
                    marginBottom: 12, fontSize: 13, color: COLORS.accent, fontWeight: 500,
                  }}>
                    Liberarías {formatCurrency(savedFromExpenses)}/mes
                    {" → "}{formatCurrency(effectiveMonthly)}/mes en total
                  </div>
                )}
                {expenses.map(exp => (
                  <ExpenseToggle
                    key={exp.id}
                    expense={exp}
                    onToggle={() => {
                      setExpenses(expenses.map(e => e.id === exp.id ? { ...e, active: !e.active } : e));
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* CTA */}
          <button style={{
            width: "100%", marginTop: 20, padding: "16px",
            background: effectiveMonthly > 0 ? COLORS.primary : COLORS.border,
            color: effectiveMonthly > 0 ? "#fff" : COLORS.textDim,
            border: "none", borderRadius: 12, fontSize: 16, fontWeight: 700,
            cursor: effectiveMonthly > 0 ? "pointer" : "default",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s ease",
          }}>
            {effectiveMonthly > 0
              ? `Fijar ${formatCurrency(effectiveMonthly)}/mes como objetivo`
              : "Configura un plan de ahorro primero"}
          </button>
          <div style={{ textAlign: "center", fontSize: 12, color: COLORS.textDim, marginTop: 8 }}>
            Esto actualizará tu objetivo mensual en la pestaña Objetivo
          </div>
        </>
      )}

      {activeTab === "historial" && (
        <div style={{
          background: COLORS.bgCard, borderRadius: 14, padding: "40px 24px",
          border: `1px solid ${COLORS.border}`, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, color: COLORS.textMuted }}>
            Aquí verás el historial de aportaciones a este proyecto
          </div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>
            (Placeholder para la siguiente iteración)
          </div>
        </div>
      )}
    </div>
  );
}

export default function FimnonProyectos() {
  const [view, setView] = useState("list");
  const [selectedProject, setSelectedProject] = useState(null);

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh",
      fontFamily: "'DM Sans', -apple-system, sans-serif", color: COLORS.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Nav bar mock */}
      <div style={{
        borderBottom: `1px solid ${COLORS.border}`,
        padding: "14px 32px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, background: COLORS.primary,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 800, color: "#fff",
          }}>F</div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Finnon</span>
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 14 }}>
          {["Inicio", "Movimientos", "Proyectos", "Objetivo", "Tu Cuenta"].map(item => (
            <span
              key={item}
              style={{
                color: item === "Proyectos" ? COLORS.text : COLORS.textMuted,
                fontWeight: item === "Proyectos" ? 600 : 400,
                cursor: "pointer",
                padding: "4px 10px",
                borderRadius: 6,
                background: item === "Proyectos" ? COLORS.primaryDim : "transparent",
              }}
            >
              {item}
            </span>
          ))}
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: COLORS.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: COLORS.bg,
        }}>AG</div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        {view === "list" ? (
          <ProjectListView
            projects={MOCK_PROJECTS}
            onSelect={(p) => { setSelectedProject(p); setView("detail"); }}
            onNew={() => {}}
          />
        ) : (
          <ProjectDetailView
            project={selectedProject}
            onBack={() => setView("list")}
          />
        )}
      </div>
    </div>
  );
}
