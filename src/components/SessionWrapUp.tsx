"use client";

import { useEffect, useState } from "react";
import type { ChildConfidence, Enjoyment } from "@/lib/types";
import styles from "./SessionWrapUp.module.css";

type TodayPayload = {
  topic: string;
  grammar: string;
  newWords: string[];
  reviewWords: string[];
  vocabulary: string[];
};

type Props = {
  durationMin: number;
  onDone: () => void;
  onSkip: () => void;
};

export default function SessionWrapUp({
  durationMin,
  onDone,
  onSkip,
}: Props) {
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [correct, setCorrect] = useState<Record<string, boolean>>({});
  const [forgot, setForgot] = useState<Record<string, boolean>>({});
  const [confidence, setConfidence] = useState<ChildConfidence>("ok");
  const [enjoyment, setEnjoyment] = useState<Enjoyment>("😀");
  const [notes, setNotes] = useState("");
  const [grammarWeak, setGrammarWeak] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/session/today");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Load failed");
        if (cancelled) return;
        setToday(data);
        const words = [
          ...new Set([
            ...(data.newWords as string[]),
            ...(data.reviewWords as string[]),
          ]),
        ];
        const init: Record<string, boolean> = {};
        for (const w of words) init[w] = false;
        setCorrect(init);
        setForgot(init);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Load failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const words = today
    ? [...new Set([...today.newWords, ...today.reviewWords])]
    : [];

  async function submit() {
    if (!today) return;
    setSaving(true);
    setError(null);
    try {
      const words_correct = words.filter((w) => correct[w] && !forgot[w]);
      const words_forgot = words.filter((w) => forgot[w]);
      const res = await fetch("/api/session/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_min: durationMin,
          topic: today.topic,
          words_correct,
          words_forgot,
          child_confidence: confidence,
          enjoyment,
          notes,
          grammar_weak: grammarWeak ? today.grammar : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Kết thúc buổi học</h2>
      <p className={styles.meta}>
        Khoảng {durationMin} phút · Chủ đề: {today?.topic ?? "…"}
      </p>

      {words.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.heading}>Từ hôm nay</h3>
          <p className={styles.hint}>
            Đánh dấu từ con dùng đúng / còn quên (quy tắc bảo thủ — không tự
            &quot;learned&quot; sau 1 lần).
          </p>
          <ul className={styles.wordList}>
            {words.map((w) => (
              <li key={w} className={styles.wordRow}>
                <span className={styles.word}>{w}</span>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(correct[w])}
                    onChange={(e) => {
                      setCorrect((prev) => ({
                        ...prev,
                        [w]: e.target.checked,
                      }));
                      if (e.target.checked) {
                        setForgot((prev) => ({ ...prev, [w]: false }));
                      }
                    }}
                  />{" "}
                  Đúng
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(forgot[w])}
                    onChange={(e) => {
                      setForgot((prev) => ({
                        ...prev,
                        [w]: e.target.checked,
                      }));
                      if (e.target.checked) {
                        setCorrect((prev) => ({ ...prev, [w]: false }));
                      }
                    }}
                  />{" "}
                  Quên
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={styles.section}>
        <h3 className={styles.heading}>Did you enjoy today?</h3>
        <div className={styles.row}>
          {(["😀", "😐", "🙁"] as Enjoyment[]).map((e) => (
            <button
              key={e}
              type="button"
              className={
                enjoyment === e ? styles.chipActive : styles.chip
              }
              onClick={() => setEnjoyment(e)}
            >
              {e}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.heading}>Con tự tin thế nào?</h3>
        <div className={styles.row}>
          {(
            [
              ["good", "Tự tin"],
              ["ok", "Ổn"],
              ["shy", "Ngại"],
            ] as [ChildConfidence, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                confidence === value ? styles.chipActive : styles.chip
              }
              onClick={() => setConfidence(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={grammarWeak}
          onChange={(e) => setGrammarWeak(e.target.checked)}
        />
        Ngữ pháp hôm nay còn yếu ({today?.grammar || "—"})
      </label>

      <textarea
        className={styles.notes}
        rows={2}
        placeholder="Ghi chú ngắn (tuỳ chọn)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={saving || !today}
          onClick={() => void submit()}
        >
          {saving ? "Đang lưu…" : "Lưu buổi học"}
        </button>
        <button type="button" className={styles.secondary} onClick={onSkip}>
          Bỏ qua
        </button>
      </div>
    </div>
  );
}
