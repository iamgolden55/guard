// Dev-only token swatch page. Mounted at /dev/theme in dev mode only.
// Verifies the tokens.ts ↔ tailwind.config.ts ↔ tokens.css bridge end-to-end.
import {
  Avatar,
  Button,
  Card,
  Icon,
  Input,
  Pill,
  SectionHeader,
  textStyles,
  tokens,
} from "../../design-system";
import { accents, type AccentName } from "../../design-system/accents";
import { useAccent } from "../../contexts/AccentContext";

const INK_KEYS = [
  "ink50",
  "ink100",
  "ink200",
  "ink300",
  "ink400",
  "ink500",
  "ink600",
  "ink700",
  "ink800",
  "ink900",
] as const;

const SEMANTIC = [
  { name: "primary", soft: tokens.color.primarySoft, base: tokens.color.primary, ink: tokens.color.primaryInk },
  { name: "success", soft: tokens.color.successSoft, base: tokens.color.success, ink: tokens.color.successInk },
  { name: "warn", soft: tokens.color.warnSoft, base: tokens.color.warn, ink: tokens.color.warnInk },
  { name: "danger", soft: tokens.color.dangerSoft, base: tokens.color.danger, ink: tokens.color.dangerInk },
  { name: "info", soft: tokens.color.infoSoft, base: tokens.color.info, ink: tokens.color.infoInk },
];

function Swatch({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div
        style={{
          width: 80,
          height: 56,
          borderRadius: tokens.radius.md,
          background: color,
          border: `1px solid ${tokens.color.ink200}`,
        }}
      />
      <div style={{ ...textStyles.mute, fontSize: 11 }}>{label}</div>
      <div style={{ ...textStyles.mute, fontSize: 10, fontFamily: tokens.font.mono }}>{color}</div>
    </div>
  );
}

export default function ThemeSmokePage() {
  const { accent, setAccent } = useAccent();

  return (
    <div style={{ background: tokens.color.ink50, minHeight: "100vh", padding: 32 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
        <Card padding={28}>
          <SectionHeader
            title="Theme smoke test"
            subtitle="Visual verification of tokens.ts ↔ tokens.css ↔ tailwind.config.ts"
            right={
              <div style={{ display: "flex", gap: 8 }}>
                {(Object.keys(accents) as AccentName[]).map((a) => (
                  <Button
                    key={a}
                    size="sm"
                    variant={accent === a ? "primary" : "secondary"}
                    onClick={() => setAccent(a)}
                  >
                    {a}
                  </Button>
                ))}
              </div>
            }
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <span style={{ ...textStyles.label }}>Active accent:</span>
            <Pill tone="info" dot>
              {accent}
            </Pill>
          </div>
        </Card>

        <Card padding={28}>
          <SectionHeader title="Ink scale" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {INK_KEYS.map((k) => (
              <Swatch key={k} label={k} color={tokens.color[k]} />
            ))}
          </div>
        </Card>

        <Card padding={28}>
          <SectionHeader title="Semantic colours" />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
            {SEMANTIC.map((s) => (
              <div key={s.name} style={{ display: "flex", gap: 8 }}>
                <Swatch label={`${s.name}.soft`} color={s.soft} />
                <Swatch label={s.name} color={s.base} />
                <Swatch label={`${s.name}.ink`} color={s.ink} />
              </div>
            ))}
          </div>
        </Card>

        <Card padding={28}>
          <SectionHeader title="Accent (CSS-var driven)" />
          <div style={{ display: "flex", gap: 12 }}>
            <div
              style={{
                width: 80,
                height: 56,
                borderRadius: tokens.radius.md,
                background: "var(--ms-accent-primary)",
                border: `1px solid ${tokens.color.ink200}`,
              }}
            />
            <div
              style={{
                width: 80,
                height: 56,
                borderRadius: tokens.radius.md,
                background: "var(--ms-accent-dark)",
              }}
            />
            <div
              style={{
                width: 80,
                height: 56,
                borderRadius: tokens.radius.md,
                background: "var(--ms-accent-soft)",
              }}
            />
            <div
              style={{
                width: 80,
                height: 56,
                borderRadius: tokens.radius.md,
                background: "var(--ms-accent-ink)",
              }}
            />
          </div>
          <p style={{ ...textStyles.mute, marginTop: 12 }}>
            Click an accent swatch above — these vars should swap without a remount.
          </p>
        </Card>

        <Card padding={28}>
          <SectionHeader title="Tailwind ↔ token bridge" />
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-md bg-ink-100 px-3 py-2 text-ink-800">bg-ink-100 / text-ink-800</div>
            <div className="rounded-md bg-primary px-3 py-2 text-white">bg-primary</div>
            <div className="rounded-md bg-accent px-3 py-2 text-white">bg-accent</div>
            <div className="rounded-md bg-success-soft px-3 py-2 text-success-ink">bg-success-soft</div>
            <div className="rounded-md bg-warn-soft px-3 py-2 text-warn-ink">bg-warn-soft</div>
            <div className="rounded-md bg-danger-soft px-3 py-2 text-danger-ink">bg-danger-soft</div>
            <div className="rounded-md bg-info-soft px-3 py-2 text-info-ink">bg-info-soft</div>
            <div className="rounded-pill bg-ink-100 px-3 py-1 text-ink-800">rounded-pill</div>
            <div className="rounded-md shadow-md bg-ink-0 px-3 py-2">shadow-md</div>
          </div>
        </Card>

        <Card padding={28}>
          <SectionHeader title="Primitives" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" size="sm">
                Small
              </Button>
              <Button variant="primary" size="lg">
                Large
              </Button>
              <Button variant="icon">
                <Icon name="more" size={16} />
              </Button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Pill tone="neutral">neutral</Pill>
              <Pill tone="positive" dot>
                positive
              </Pill>
              <Pill tone="warning" dot>
                warning
              </Pill>
              <Pill tone="danger" dot>
                danger
              </Pill>
              <Pill tone="info" dot>
                info
              </Pill>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar name="Alex Mead" size={32} />
              <Avatar name="Priya Shah" hue={280} size={36} />
              <Avatar name="James Okafor" hue={12} size={44} />
              <Avatar name="Marcus Bell" hue={160} size={56} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
              <Input placeholder="Default input" />
              <Input
                placeholder="With leading icon"
                leading={<Icon name="search" size={14} style={{ color: tokens.color.ink500 }} />}
              />
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(["squares-2x2", "calendar", "clock", "users", "shield", "alert", "receipt", "banknote", "search", "bell", "plus", "check", "x", "more", "menu"] as const).map((n) => (
                <div
                  key={n}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: tokens.radius.md,
                    border: `1px solid ${tokens.color.ink200}`,
                    color: tokens.color.ink700,
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <Icon name={n} size={18} />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
