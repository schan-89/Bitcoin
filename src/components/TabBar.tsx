export type TabId = "now" | "indicators" | "records";

// 아이콘은 Lucide 계열 선 아이콘(2px 선, 24 격자)으로 통일한다.
const ICONS: Record<TabId, React.ReactNode> = {
  now: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  indicators: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9" />
      <path d="M13 17V5" />
      <path d="M8 17v-3" />
    </>
  ),
  records: (
    <>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </>
  ),
};

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
          <svg
            className="tab-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[t.id]}
          </svg>
          <span className="tab-label">{t.label}</span>
          <span className="tab-hint">{t.hint}</span>
        </button>
      ))}
    </nav>
  );
}
