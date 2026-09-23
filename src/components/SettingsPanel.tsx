import { useState } from "react";
import type { Zone, ZoneTone } from "../types";

const TONES: ZoneTone[] = ["위험", "경계", "관망", "긍정", "과열주의"];

interface Props {
  zones: Zone[];
  onSave: (zones: Zone[]) => void;
  onClose: () => void;
  finnhubApiKey: string;
  onSaveFinnhubApiKey: (key: string) => void;
}

export function SettingsPanel({ zones, onSave, onClose, finnhubApiKey, onSaveFinnhubApiKey }: Props) {
  const [draft, setDraft] = useState<Zone[]>(() =>
    zones.map((z) => ({ ...z, max: Number.isFinite(z.max) ? z.max : Infinity })),
  );
  const [keyDraft, setKeyDraft] = useState(finnhubApiKey);

  function updateZone(id: string, patch: Partial<Zone>) {
    setDraft((prev) => prev.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  }

  function addZone() {
    const lastMax = draft.reduce((acc, z) => (Number.isFinite(z.max) ? Math.max(acc, z.max) : acc), 0);
    setDraft((prev) => [
      ...prev,
      { id: `z${Date.now()}`, min: lastMax, max: lastMax + 5000, label: "새 구간", tone: "관망" },
    ]);
  }

  function removeZone(id: string) {
    setDraft((prev) => prev.filter((z) => z.id !== id));
  }

  function handleSave() {
    const sorted = [...draft].sort((a, b) => a.min - b.min);
    onSave(sorted);
    onClose();
  }

  return (
    <div className="settings-overlay" role="dialog" aria-label="기준선 설정">
      <div className="settings-panel">
        <h2>Finnhub API 키</h2>
        <p className="settings-note">
          QQQ·SOXL·EWY·EWJ·SPY 2X 같은 미국 상장 종목을 자동으로 조회하려면 무료 Finnhub 키가 필요합니다.{" "}
          <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">
            무료 발급
          </a>
          . 이 키는 본인 브라우저에만 저장되고 어디로도 전송되지 않습니다.
        </p>
        <div className="settings-row">
          <input
            type="text"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Finnhub API 키"
            aria-label="Finnhub API 키"
          />
          <button type="button" className="primary" onClick={() => onSaveFinnhubApiKey(keyDraft)}>
            키 저장
          </button>
        </div>

        <h2>기준선 설정</h2>
        <p className="settings-note">
          가격 구간(기준선)을 직접 수정할 수 있습니다. 한번 세운 기준은 감정적으로 자주 바꾸지 않는 것을
          권장합니다.
        </p>
        <div className="settings-list">
          {draft.map((z) => (
            <div className="settings-row" key={z.id}>
              <input
                type="number"
                value={z.min}
                onChange={(e) => updateZone(z.id, { min: Number(e.target.value) })}
                aria-label="최소 가격"
              />
              <span>~</span>
              <input
                type="number"
                value={Number.isFinite(z.max) ? z.max : ""}
                placeholder="무제한"
                onChange={(e) =>
                  updateZone(z.id, { max: e.target.value === "" ? Infinity : Number(e.target.value) })
                }
                aria-label="최대 가격"
              />
              <input
                type="text"
                value={z.label}
                onChange={(e) => updateZone(z.id, { label: e.target.value })}
                aria-label="구간 이름"
              />
              <select
                value={z.tone}
                onChange={(e) => updateZone(z.id, { tone: e.target.value as ZoneTone })}
                aria-label="톤"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button type="button" className="remove-btn" onClick={() => removeZone(z.id)}>
                삭제
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="add-zone-btn" onClick={addZone}>
          + 구간 추가
        </button>
        <div className="settings-actions">
          <button type="button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
