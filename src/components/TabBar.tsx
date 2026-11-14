export type TabId = "now" | "indicators" | "records";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "now", label: "현황", hint: "가격·구간·차트" },
  { id: "indicators", label: "지표", hint: "A지표·실수요" },
  { id: "records", label: "기록", hint: "입력·매매 장부" },
];

interface Props {
  active: TabId;
  onChange: (id: TabId) => void;
  /** A지표·실수요 판정은 비트코인 분석 프레임이라 다른 자산에서는 탭 자체를 숨긴다. */
  showIndicators: boolean;
}

export function TabBar({ active, onChange, showIndicators }: Props) {
  const tabs = showIndicators ? TABS : TABS.filter((t) => t.id !== "indicators");
  return (
    <nav className="tab-bar" aria-label="화면 이동">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`tab-btn ${active === t.id ? "active" : ""}`}
          aria-current={active === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="tab-label">{t.label}</span>
          <span className="tab-hint">{t.hint}</span>
        </button>
      ))}
    </nav>
  );
}
