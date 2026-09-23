import { useState } from "react";
import { PRESET_ASSETS } from "../lib/assets";
import type { Asset } from "../types";

interface Props {
  assets: Asset[];
  activeId: string;
  onSelect: (id: string) => void;
  onAddPreset: (preset: Asset) => void;
  onAddCustom: (name: string, currency: string) => void;
  onRemove: (id: string) => void;
}

export function AssetSwitcher({ assets, activeId, onSelect, onAddPreset, onAddCustom, onRemove }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("₩");

  const existingIds = new Set(assets.map((a) => a.id));
  const availablePresets = PRESET_ASSETS.filter((p) => !existingIds.has(p.id));

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddCustom(trimmed, currency);
    setName("");
    setAdding(false);
  }

  return (
    <div className="asset-switcher">
      <div className="asset-tabs">
        {assets.map((a) => (
          <button
            key={a.id}
            type="button"
            className={`asset-tab ${a.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(a.id)}
          >
            {a.name}
          </button>
        ))}
        <button type="button" className="asset-tab add" onClick={() => setAdding((v) => !v)}>
          {adding ? "닫기" : "+ 자산"}
        </button>
      </div>

      {adding && (
        <div className="asset-add-panel">
          {availablePresets.length > 0 && (
            <>
              <p className="section-sub">라방에서 운용 중인 자산 (분할매수 계획 포함):</p>
              <div className="preset-list">
                {availablePresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="preset-btn"
                    onClick={() => {
                      onAddPreset(p);
                      // 직접 추가와 동작을 맞춘다 — 추가하면 그 자산으로 넘어가므로 패널은 닫는다.
                      setAdding(false);
                    }}
                  >
                    + {p.name}
                  </button>
                ))}
              </div>
            </>
          )}

          <form className="entry-form" onSubmit={handleAddCustom}>
            <input
              type="text"
              placeholder="직접 추가 (예: SK하이닉스)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="통화">
              <option value="₩">₩ 원</option>
              <option value="$">$ 달러</option>
            </select>
            <button type="submit">추가</button>
          </form>

          {assets.length > 1 && (
            <div className="asset-remove-row">
              {assets
                .filter((a) => a.id !== "btc")
                .map((a) => (
                  <button key={a.id} type="button" className="remove-btn" onClick={() => onRemove(a.id)}>
                    {a.name} 삭제
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
