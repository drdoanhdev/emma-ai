"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DAY_MODE_OPTIONS,
  type DayMode,
  type PreferenceMemory,
} from "@/lib/types";
import type { ParentDashboard } from "@/lib/dashboard";
import styles from "./parent.module.css";

type ParentPayload = {
  state: {
    mission: {
      parent_note: string;
      day_mode: DayMode;
      topic: string;
      current_unit: number;
    };
    preference_memory: PreferenceMemory;
  };
  dashboard: ParentDashboard;
};

export default function ParentPage() {
  const [parentNote, setParentNote] = useState("");
  const [dayMode, setDayMode] = useState<DayMode>("normal");
  const [topic, setTopic] = useState("");
  const [unit, setUnit] = useState(0);
  const [prefs, setPrefs] = useState<PreferenceMemory>({
    favorite_animal: "",
    favorite_game: "",
    favorite_sport: "",
  });
  const [dashboard, setDashboard] = useState<ParentDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function applyPayload(data: ParentPayload) {
    setParentNote(data.state.mission.parent_note ?? "");
    setDayMode(data.state.mission.day_mode ?? "normal");
    setTopic(data.state.mission.topic ?? "");
    setUnit(data.state.mission.current_unit ?? 0);
    setPrefs(data.state.preference_memory);
    setDashboard(data.dashboard);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/parent/mission");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Load failed");
        if (cancelled) return;
        applyPayload(data as ParentPayload);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: {
    parent_note?: string;
    day_mode?: DayMode;
    preference_memory?: PreferenceMemory;
  }) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/parent/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      applyPayload(data as ParentPayload);
      setMessage("Đã lưu.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className={styles.main}>
        <p>Đang tải…</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Phụ huynh</h1>
        <Link href="/" className={styles.back}>
          ← Về Emma
        </Link>
      </header>

      <p className={styles.meta}>
        Unit {unit}: {topic || "—"} · Mode: {dayMode}
      </p>

      {dashboard && (
        <section className={styles.section}>
          <h2 className={styles.heading}>Tổng quan luyện tập</h2>
          <p className={styles.hint}>
            Không chấm điểm IQ, không xếp hạng — chỉ số liệu thực tế.
          </p>
          <ul className={styles.stats}>
            <li>
              Tổng phút đã luyện: <strong>{dashboard.totalMinutes}</strong> (
              {dashboard.sessionCount} buổi)
            </li>
            <li>
              Từ đã vững (learned):{" "}
              {dashboard.learnedWords.length
                ? dashboard.learnedWords.join(", ")
                : "—"}
            </li>
            <li>
              Từ đang học:{" "}
              {dashboard.learningWords.length
                ? dashboard.learningWords.join(", ")
                : "—"}
            </li>
            <li>
              Chủ đề đã luyện:{" "}
              {dashboard.topicsCompleted.length
                ? dashboard.topicsCompleted.join(", ")
                : "—"}
            </li>
            <li>
              Cần ôn hôm nay:{" "}
              {dashboard.dueForReview.length
                ? dashboard.dueForReview.join(", ")
                : "—"}
            </li>
            <li>
              Ngữ pháp đã gặp:{" "}
              {dashboard.grammarCovered.length
                ? dashboard.grammarCovered.join(", ")
                : "—"}
            </li>
            <li>
              Ngữ pháp còn yếu:{" "}
              {dashboard.grammarWeak.length
                ? dashboard.grammarWeak.join(", ")
                : "—"}
            </li>
          </ul>
        </section>
      )}

      {dashboard && (
        <section className={styles.section}>
          <h2 className={styles.heading}>Success Metrics (tuần này)</h2>
          <ul className={styles.stats}>
            <li>
              Engagement — số ngày mở Emma:{" "}
              <strong>{dashboard.metrics.daysThisWeek}</strong> · TB phút/buổi:{" "}
              {dashboard.metrics.avgDurationMin || "—"}
            </li>
            <li>
              Confidence (5 buổi gần):{" "}
              {dashboard.metrics.recentConfidence.length
                ? dashboard.metrics.recentConfidence.join(" → ")
                : "—"}
            </li>
            <li>
              Enjoyment: 😀 {dashboard.metrics.enjoymentCounts["😀"]} · 😐{" "}
              {dashboard.metrics.enjoymentCounts["😐"]} · 🙁{" "}
              {dashboard.metrics.enjoymentCounts["🙁"]}
            </li>
            <li>
              Vocabulary — từ learned (dùng lại ≥3 buổi):{" "}
              {dashboard.learnedWords.length}
            </li>
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.heading}>Parent Mission</h2>
        <p className={styles.hint}>
          Ghi chú tuần này. Nếu có nội dung, Emma ưu tiên note này thay vì
          Curriculum.
        </p>
        <textarea
          className={styles.textarea}
          rows={4}
          value={parentNote}
          onChange={(e) => setParentNote(e.target.value)}
          placeholder="Ví dụ: Con sắp kiểm tra Speaking tuần này."
        />
        <button
          type="button"
          className={styles.saveBtn}
          disabled={saving}
          onClick={() => save({ parent_note: parentNote })}
        >
          {saving ? "Đang lưu…" : "Lưu Parent Mission"}
        </button>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Day mode hôm nay</h2>
        <div className={styles.modes}>
          {DAY_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={
                dayMode === opt.value
                  ? `${styles.modeBtn} ${styles.modeBtnActive}`
                  : styles.modeBtn
              }
              disabled={saving}
              onClick={() => save({ day_mode: opt.value })}
            >
              <span className={styles.modeLabel}>{opt.label}</span>
              <span className={styles.modeHint}>{opt.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Sở thích an toàn</h2>
        <p className={styles.hint}>
          Chỉ lưu likes nhẹ (động vật / game / thể thao) — không lưu chuyện gia
          đình, cảm xúc tiêu cực, bệnh tật.
        </p>
        <label className={styles.field}>
          Động vật yêu thích
          <input
            className={styles.input}
            value={prefs.favorite_animal}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, favorite_animal: e.target.value }))
            }
          />
        </label>
        <label className={styles.field}>
          Game yêu thích
          <input
            className={styles.input}
            value={prefs.favorite_game}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, favorite_game: e.target.value }))
            }
          />
        </label>
        <label className={styles.field}>
          Thể thao yêu thích
          <input
            className={styles.input}
            value={prefs.favorite_sport}
            onChange={(e) =>
              setPrefs((p) => ({ ...p, favorite_sport: e.target.value }))
            }
          />
        </label>
        <button
          type="button"
          className={styles.saveBtn}
          disabled={saving}
          onClick={() => save({ preference_memory: prefs })}
        >
          {saving ? "Đang lưu…" : "Lưu sở thích"}
        </button>
      </section>

      {message && <p className={styles.ok}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
