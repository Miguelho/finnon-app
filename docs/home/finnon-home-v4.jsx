import { useState } from "react";

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
  text: "#FAFAF8",
  textMuted: "#9E9E9E",
  textDim: "#666",
  border: "#333",
  borderLight: "#3A3A3A",
};

const DAYS = [
  { day: "LUN", num: 23 },
  { day: "MAR", num: 24 },
  { day: "MIÉ", num: 25, today: true, dot: true },
  { day: "JUE", num: 26 },
  { day: "VIE", num: 27 },
  { day: "SÁB", num: 28, dot: true },
  { day: "DOM", num: 1 },
];

function formatCurrencyPlain(n) {
  return n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ──────── STATE SWITCHER ────────
function StateSwitcher({ state, onChange }) {
  const states = [
    { key: "active", label: "Proyecto activo" },
    { key: "empty", label: "Sin proyectos" },
    { key: "completed", label: "Completado" },
    { key: "all_done", label: "Todos completados" },
  ];
  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
      {states.map(s => (
        <button
          key={s.key}
          onClick={() => onChange(s.key)}
          style={{
            padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "none",
            borderRadius: 20, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            background: state === s.key ? COLORS.primary : COLORS.bgCard,
            color: state === s.key ? "#fff" : COLORS.textMuted,
            transition: "all 0.2s ease",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

// ──────── UNIFIED CALENDAR + SCHEDULED WIDGET ────────
function CalendarWidget() {
  const [selectedDay, setSelectedDay] = useState(25);

  const dayMovements = {
    25: [
      { name: "Mapfre seguro", category: "Transporte", amount: -45, icon: "↓" },
    ],
    28: [
      { name: "Spotify", category: "Ocio", amount: -10.99, icon: "↓" },
    ],
  };

  const allScheduled = [
    { name: "Spotify", date: "28 feb", dayNum: 28, amount: -10.99, icon: "↓", category: "Ocio" },
    { name: "Alquiler", date: "1 mar", dayNum: 32, amount: -850, icon: "↓", category: "Vivienda" },
    { name: "Gimnasio", date: "3 mar", dayNum: 34, amount: -39.99, icon: "↓", category: "Salud" },
  ];

  // Find next scheduled event after selected day
  const nextScheduled = allScheduled.find(s => s.dayNum > selectedDay);
  const todayMovements = dayMovements[selectedDay] || [];

  const dayLabel = (num) => {
    if (num === 1) return "Domingo, 1 de marzo";
    const names = { 23: "Lunes", 24: "Martes", 25: "Miércoles", 26: "Jueves", 27: "Viernes", 28: "Sábado" };
    return `${names[num]}, ${num} de febrero`;
  };

  const weekTotals = { income: 0, expense: -45, net: -45 };

  return (
    <div style={{
      background: COLORS.bgCard, borderRadius: 14, padding: "20px",
      border: `1px solid ${COLORS.border}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
          Calendario
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <span style={{
            padding: "4px 12px", fontSize: 12, borderRadius: 6, fontWeight: 600,
            background: COLORS.text, color: COLORS.bg, fontFamily: "'DM Sans', sans-serif",
          }}>Semana</span>
          <span style={{
            padding: "4px 12px", fontSize: 12, borderRadius: 6,
            color: COLORS.textMuted, fontFamily: "'DM Sans', sans-serif",
          }}>Mes</span>
        </div>
      </div>

      {/* Week nav */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <span style={{ color: COLORS.textDim, cursor: "pointer" }}>‹</span>
        <span style={{ fontSize: 13, color: COLORS.textMuted }}>23 feb – 1 mar</span>
        <span style={{ color: COLORS.textDim, cursor: "pointer" }}>›</span>
      </div>

      {/* Day grid */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        {DAYS.map(d => (
          <div
            key={d.num}
            onClick={() => setSelectedDay(d.num)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              width: 40, cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 10, color: COLORS.textDim, fontWeight: 500 }}>{d.day}</span>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600,
              background: d.num === selectedDay ? (d.today ? COLORS.text : COLORS.primaryDim) : "transparent",
              color: d.num === selectedDay ? (d.today ? COLORS.bg : COLORS.primary) : COLORS.text,
              fontFamily: "'DM Sans', sans-serif",
              border: d.today && d.num !== selectedDay ? `2px solid ${COLORS.textDim}` : "none",
              transition: "all 0.15s ease",
            }}>
              {d.num}
            </div>
            {d.dot && (
              <div style={{
                width: 5, height: 5, borderRadius: "50%",
                background: d.num === selectedDay ? COLORS.primary : COLORS.danger,
                marginTop: -2,
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Week summary */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, marginBottom: 16 }}>
        <span>Ingresos <span style={{ color: COLORS.accent }}>+€0,00</span></span>
        <span>Gastos <span style={{ color: COLORS.danger }}>-€45,00</span></span>
        <span>Neto <span style={{ color: COLORS.danger }}>-€45,00</span></span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: COLORS.border, marginBottom: 14 }} />

      {/* Selected day movements */}
      <div style={{ marginBottom: todayMovements.length > 0 && nextScheduled ? 16 : 0 }}>
        <div style={{
          fontSize: 11, color: COLORS.textDim, fontWeight: 600, letterSpacing: 0.5,
          marginBottom: 10, textTransform: "uppercase",
        }}>
          {dayLabel(selectedDay)}
        </div>

        {todayMovements.length > 0 ? (
          todayMovements.map((mov, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingTop: i > 0 ? 10 : 0,
              borderTop: i > 0 ? `1px solid ${COLORS.border}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: COLORS.bgInput,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: COLORS.danger,
                }}>{mov.icon}</div>
                <div>
                  <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{mov.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>{mov.category}</div>
                </div>
              </div>
              <span style={{ fontSize: 14, color: COLORS.danger, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                -€{Math.abs(mov.amount).toFixed(2).replace(".", ",")}
              </span>
            </div>
          ))
        ) : (
          <div style={{ fontSize: 13, color: COLORS.textDim }}>
            No hay movimientos este día.
          </div>
        )}
      </div>

      {/* Next scheduled event */}
      {nextScheduled && (
        <>
          <div style={{ height: 1, background: COLORS.border, marginTop: 14, marginBottom: 14 }} />
          <div>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 10,
            }}>
              <span style={{
                fontSize: 11, color: COLORS.textDim, fontWeight: 600,
                letterSpacing: 0.5, textTransform: "uppercase",
              }}>
                Próximo programado
              </span>
              <span style={{
                fontSize: 12, color: COLORS.primary, fontWeight: 500, cursor: "pointer",
              }}>
                Ver todos →
              </span>
            </div>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: COLORS.bgInput,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: COLORS.accentWarm,
                }}>⏱</div>
                <div>
                  <div style={{ fontSize: 14, color: COLORS.text, fontWeight: 500 }}>{nextScheduled.name}</div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>{nextScheduled.date} · {nextScheduled.category}</div>
                </div>
              </div>
              <span style={{ fontSize: 14, color: COLORS.textMuted, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
                -€{Math.abs(nextScheduled.amount).toFixed(2).replace(".", ",")}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ──────── FUSED PROJECT+OBJECTIVE WIDGET ────────
function ProjectObjectiveWidget({ state }) {
  if (state === "empty") {
    return (
      <div style={{
        background: COLORS.bgCard, borderRadius: 14,
        border: `1px solid ${COLORS.border}`, padding: "32px 24px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
          ¿Tenéis un sueño?
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
          Cread vuestro primer proyecto y<br />empezad a acercarlo.
        </div>
        <button style={{
          background: COLORS.primary, color: "#fff", border: "none", borderRadius: 10,
          padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Crear proyecto
        </button>
      </div>
    );
  }

  if (state === "completed") {
    return (
      <div style={{
        background: COLORS.accentDim, borderRadius: 14,
        border: `1px solid rgba(74,234,177,0.25)`, padding: "28px 24px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🏰</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.accent, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
          ¡Eurodisney conseguido!
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 16 }}>
          Habéis ahorrado €6.000 en 14 meses
        </div>
        <div style={{ fontSize: 36, marginBottom: 16 }}>🎉</div>
        <button style={{
          background: "transparent", color: COLORS.accent, border: `1px solid rgba(74,234,177,0.3)`,
          borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 600,
          cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>
          Ver proyecto →
        </button>
      </div>
    );
  }

  if (state === "all_done") {
    return (
      <div style={{
        background: COLORS.bgCard, borderRadius: 14,
        border: `1px solid ${COLORS.border}`, padding: "32px 24px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌟</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.text, marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>
          ¡Habéis cumplido todos vuestros proyectos!
        </div>
        <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
          ¿Cuál es el siguiente sueño?
        </div>
        <button style={{
          background: COLORS.primary, color: "#fff", border: "none", borderRadius: 10,
          padding: "12px 28px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          Nuevo proyecto
        </button>
      </div>
    );
  }

  // ──── ACTIVE PROJECT ────
  const project = { name: "Eurodisney", emoji: "🏰", target: 6000, saved: 1850, monthly: 350 };
  const progress = project.saved / project.target;
  const remaining = project.target - project.saved;
  const monthsLeft = remaining / project.monthly;
  const estimatedDate = new Date();
  estimatedDate.setMonth(estimatedDate.getMonth() + Math.ceil(monthsLeft));
  const dateStr = estimatedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const objectiveTarget = 500;
  const objectiveCurrent = 1372;
  const objectiveProgress = Math.min(objectiveCurrent / objectiveTarget, 1);

  return (
    <div style={{
      background: COLORS.bgCard, borderRadius: 14,
      border: `1px solid ${COLORS.border}`, overflow: "hidden",
    }}>
      {/* Project section */}
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>{project.emoji}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
                {project.name}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                {formatCurrencyPlain(project.saved)} de {formatCurrencyPlain(project.target)}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: 13, color: COLORS.primary, fontWeight: 600, cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Ver detalle →
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ position: "relative", marginBottom: 8 }}>
          <div style={{ height: 7, borderRadius: 4, background: COLORS.bgInput }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.accent})`,
              width: `${progress * 100}%`,
              transition: "width 0.6s ease",
            }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.accent, fontFamily: "'DM Sans', sans-serif" }}>
            {Math.round(progress * 100)}%
          </span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>
            📅 {dateStr}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: COLORS.border }} />

      {/* Objective section */}
      <div style={{ padding: "16px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: COLORS.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: COLORS.bg, fontWeight: 800,
          }}>✓</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, fontFamily: "'DM Sans', sans-serif" }}>
            Vas bien
          </span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>
            · Ahorrar {formatCurrencyPlain(objectiveTarget)} en feb 2026
          </span>
        </div>

        <div style={{ position: "relative", marginBottom: 8 }}>
          <div style={{ height: 5, borderRadius: 3, background: COLORS.bgInput }}>
            <div style={{
              height: "100%", borderRadius: 3, background: COLORS.accent,
              width: `${objectiveProgress * 100}%`,
            }} />
          </div>
          <div style={{
            position: "absolute", top: -3, right: 0,
            width: 2, height: 11, background: COLORS.textMuted, borderRadius: 1,
          }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: COLORS.text, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            €{objectiveCurrent.toLocaleString("es-ES")} ahorrado
          </span>
          <span style={{ color: COLORS.textMuted }}>
            de €{objectiveTarget.toLocaleString("es-ES")}
          </span>
        </div>

        <div style={{
          marginTop: 10, fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5,
          background: COLORS.bgInput, borderRadius: 8, padding: "10px 12px",
        }}>
          Este mes acercas <strong style={{ color: COLORS.accent }}>{project.name}</strong> un <strong style={{ color: COLORS.accent }}>6%</strong> más.
          Sigue así para cumplir el objetivo.
        </div>
      </div>
    </div>
  );
}

// ──────── NAVBARS ────────
function NavBarTop() {
  return (
    <div style={{
      borderBottom: `1px solid ${COLORS.border}`, padding: "14px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, background: COLORS.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "#fff",
        }}>F</div>
        <span style={{ fontWeight: 700, fontSize: 15, color: COLORS.text }}>Finnon</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 18, color: COLORS.textMuted, cursor: "pointer" }}>✉</span>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", background: COLORS.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: COLORS.bg,
        }}>AG</div>
      </div>
    </div>
  );
}

function NavBarBottom() {
  const tabs = [
    { label: "Inicio", icon: "🏠", active: true },
    { label: "Movimientos", icon: "📋" },
    { label: "", icon: "+", isAdd: true },
    { label: "Proyectos", icon: "🎯" },
    { label: "Objetivo", icon: "📊" },
  ];

  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 430,
      background: COLORS.bg, borderTop: `1px solid ${COLORS.border}`,
      display: "flex", justifyContent: "space-around", alignItems: "center",
      padding: "8px 0 20px", zIndex: 100,
    }}>
      {tabs.map((tab, i) => (
        <div key={i} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          cursor: "pointer", minWidth: 56,
        }}>
          {tab.isAdd ? (
            <div style={{
              width: 44, height: 44, borderRadius: "50%", background: COLORS.primary,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: "#fff", fontWeight: 300, marginTop: -16,
              boxShadow: "0 4px 12px rgba(91,141,255,0.3)",
            }}>+</div>
          ) : (
            <>
              <span style={{ fontSize: 18, opacity: tab.active ? 1 : 0.5 }}>{tab.icon}</span>
              <span style={{
                fontSize: 10, fontWeight: 500,
                color: tab.active ? COLORS.text : COLORS.textDim,
              }}>{tab.label}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────── MAIN APP ────────
export default function FimnonHomeV2() {
  const [widgetState, setWidgetState] = useState("active");

  return (
    <div style={{
      background: COLORS.bg, minHeight: "100vh",
      fontFamily: "'DM Sans', -apple-system, sans-serif", color: COLORS.text,
      display: "flex", justifyContent: "center",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 430, position: "relative" }}>
        <NavBarTop />

        <div style={{ padding: "20px 16px 100px" }}>
          {/* Demo state switcher */}
          <div style={{
            marginBottom: 16, padding: "12px", background: "rgba(91,141,255,0.08)",
            borderRadius: 10, border: "1px dashed rgba(91,141,255,0.3)",
          }}>
            <div style={{ fontSize: 11, color: COLORS.primary, textAlign: "center", marginBottom: 8, fontWeight: 600 }}>
              ⚙️ DEMO: Cambia el estado del widget
            </div>
            <StateSwitcher state={widgetState} onChange={setWidgetState} />
          </div>

          {/* Balance */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: COLORS.textDim, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 4 }}>
              Balance del mes
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: COLORS.text }}>€1.372</span>
              <span style={{ fontSize: 20, fontWeight: 400, color: COLORS.textMuted }}>,06</span>
            </div>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
              Febrero de 2026
            </div>
          </div>

          {/* Calendar (fused with Scheduled) */}
          <div style={{ marginBottom: 16 }}>
            <CalendarWidget />
          </div>

          {/* Fused Project + Objective widget */}
          <ProjectObjectiveWidget state={widgetState} />
        </div>

        <NavBarBottom />
      </div>
    </div>
  );
}
