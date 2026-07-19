"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAY_MODE_OPTIONS, type DayMode } from "@/lib/types";
import styles from "./parent.module.css";

export default function ParentPage() {
  const [parentNote, setParentNote] = useState("");
  const [dayMode, setDayMode] = useState<DayMode>("normal");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/parent/mission");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Load failed");
        if (cancelled) return;
        setParentNote(data.mission?.parent_note ?? "");
        setDayMode(data.mission?.day_mode ?? "normal");
        setTopic(data.mission?.topic ?? "");
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

  async function save(patch: { parent_note?: string; day_mode?: DayMode }) {
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
      setParentNote(data.mission.parent_note ?? "");
      setDayMode(data.mission.day_mode);
      setTopic(data.mission.topic ?? "");
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
        Unit hiện tại: {topic || "—"} · Mode: {dayMode}
      </p>

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
          placeholder="Ví dụ: Con sắp kiểm tra Speaking tuần này. Tập hỏi Do you like…?"
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
        <p className={styles.hint}>Chọn trước buổi học — Planner sẽ điều chỉnh.</p>
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

      {message && <p className={styles.ok}>{message}</p>}
      {error && <p className={styles.error}>{error}</p>}
    </main>
  );
}
