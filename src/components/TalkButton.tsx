"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./TalkButton.module.css";
import SessionWrapUp from "./SessionWrapUp";
import {
  RealtimeSessionManager,
  type Turn,
} from "@/lib/realtime-session-manager";
import type { RealtimeSessionMeta } from "@/lib/realtime-config";
import type { ContinuationContext } from "@/lib/prompt-builder";

type Status = "idle" | "connecting" | "talking" | "wrapup" | "error";

type CaptionLine = {
  id: string;
  role: "emma" | "you";
  en: string;
  vi?: string;
  pending?: boolean;
};

type RealtimeEvent = {
  type?: string;
  delta?: string;
  transcript?: string;
  item_id?: string;
  item?: { id?: string; role?: string };
  response?: {
    usage?: {
      input_tokens?: number;
      total_tokens?: number;
    };
    output?: { id?: string }[];
  };
};

const MAX_CAPTION_LINES = 12;

function friendlyMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  if (name === "NotFoundError" || /Requested device not found/i.test(message)) {
    return "Không tìm thấy microphone. Cắm mic / tai nghe có mic, rồi kiểm tra Windows Settings → Privacy → Microphone đã bật cho trình duyệt.";
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Trình duyệt bị chặn quyền microphone. Bấm biểu tượng ổ khóa trên thanh địa chỉ → cho phép Microphone → tải lại trang.";
  }
  if (name === "NotReadableError") {
    return "Microphone đang bị app khác chiếm (Zoom, Teams…). Đóng app đó rồi thử lại.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Không kết nối được microphone.";
}

function formatSessionError(
  errBody: { error?: string; detail?: string } | null,
  status: number,
): string {
  const detail = errBody?.detail ?? "";
  let openaiMessage = "";
  try {
    const parsed = JSON.parse(detail) as {
      error?: { message?: string; code?: string; type?: string };
    };
    openaiMessage = parsed.error?.message ?? "";
  } catch {
    openaiMessage = detail.slice(0, 200);
  }

  if (
    status === 429 ||
    /exceeded your current quota|billing|insufficient_quota/i.test(
      openaiMessage + detail,
    )
  ) {
    return "OpenAI hết quota / chưa thanh toán. Vào https://platform.openai.com/settings/organization/billing thêm credit, rồi thử lại.";
  }
  if (status === 401 || /invalid.?api.?key|incorrect api key/i.test(openaiMessage)) {
    return "OPENAI_API_KEY không hợp lệ. Kiểm tra .env.local (local) hoặc Vercel → Settings → Environment Variables.";
  }

  return (
    openaiMessage ||
    errBody?.error ||
    `Không tạo được Realtime session (HTTP ${status})`
  );
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    process.env.NODE_ENV === "development" ||
    new URLSearchParams(window.location.search).get("debug") === "1"
  );
}

async function translateToVi(text: string): Promise<string | undefined> {
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { translation?: string };
    return data.translation?.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function fetchSummary(turns: Turn[], priorSummary?: string | null): Promise<string> {
  const res = await fetch("/api/realtime/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      turns,
      priorSummary: priorSummary ?? undefined,
      childName: "child",
      level: "A1",
    }),
  });
  if (!res.ok) {
    throw new Error("Summarize failed");
  }
  const data = (await res.json()) as { summary?: string };
  if (!data.summary) throw new Error("Empty summary");
  return data.summary;
}

export default function TalkButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEn, setShowEn] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [lastDurationMin, setLastDurationMin] = useState(0);
  const [reconnecting, setReconnecting] = useState(false);
  const [debugStats, setDebugStats] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const emmaBufferRef = useRef("");
  const liveEmmaIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const segmentStartedAtRef = useRef<number | null>(null);
  const captionsRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const sessionMgrRef = useRef(new RealtimeSessionManager());
  const sessionMetaRef = useRef<RealtimeSessionMeta | null>(null);
  const maxOutputTokensRef = useRef(50);
  const rotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuationRef = useRef<ContinuationContext | null>(null);
  const isRotatingRef = useRef(false);
  const statusRef = useRef<Status>("idle");
  const rotateSessionRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const el = captionsRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [captions]);

  function onCaptionsScroll() {
    const el = captionsRef.current;
    if (!el) return;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 96;
  }

  const showViRef = useRef(showVi);
  useEffect(() => {
    showViRef.current = showVi;
  }, [showVi]);

  const updateDebugStats = useCallback(() => {
    if (!isDebugMode()) return;
    const s = sessionMgrRef.current.getStats();
    setDebugStats(
      `turns=${s.turnPairCount} in=${s.lastInputTokens} compact=${s.compactionCount} rotate=${s.rotateCount}`,
    );
  }, []);

  const upsertLiveEmma = useCallback((en: string) => {
    setCaptions((prev) => {
      const id = liveEmmaIdRef.current ?? newId();
      liveEmmaIdRef.current = id;
      const next = prev.filter((line) => line.id !== id);
      next.push({ id, role: "emma", en, pending: true });
      return next.slice(-MAX_CAPTION_LINES);
    });
  }, []);

  const finalizeLine = useCallback(async (role: "emma" | "you", en: string) => {
    const trimmed = en.trim();
    if (!trimmed) return;

    const id =
      role === "emma" && liveEmmaIdRef.current
        ? liveEmmaIdRef.current
        : newId();

    if (role === "emma") {
      liveEmmaIdRef.current = null;
      emmaBufferRef.current = "";
    }

    setCaptions((prev) => {
      const without = prev.filter((line) => line.id !== id);
      without.push({ id, role, en: trimmed, pending: showViRef.current });
      return without.slice(-MAX_CAPTION_LINES);
    });

    if (!showViRef.current) return;

    const vi = await translateToVi(trimmed);
    if (!vi) {
      setCaptions((prev) =>
        prev.map((line) =>
          line.id === id ? { ...line, pending: false } : line,
        ),
      );
      return;
    }

    setCaptions((prev) =>
      prev.map((line) =>
        line.id === id ? { ...line, vi, pending: false } : line,
      ),
    );
  }, []);

  const sendDataChannel = useCallback((payload: object) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== "open") return;
    dc.send(JSON.stringify(payload));
  }, []);

  const createResponse = useCallback(() => {
    sendDataChannel({
      type: "response.create",
      response: { max_output_tokens: maxOutputTokensRef.current },
    });
  }, [sendDataChannel]);

  const applyCompactionOnServer = useCallback(
    (summary: string, deletedIds: string[]) => {
      const summaryId = `sum_${Date.now()}`;
      sendDataChannel({
        type: "conversation.item.create",
        previous_item_id: "root",
        item: {
          id: summaryId,
          type: "message",
          role: "system",
          content: [{ type: "input_text", text: summary }],
        },
      });
      for (const itemId of deletedIds) {
        sendDataChannel({ type: "conversation.item.delete", item_id: itemId });
      }
    },
    [sendDataChannel],
  );

  const runCompaction = useCallback(async () => {
    const mgr = sessionMgrRef.current;
    if (!mgr.shouldCompact()) return;

    mgr.beginCompaction();
    const toSummarize = mgr.turnsToSummarize();
    try {
      const summary = await fetchSummary(toSummarize, mgr.summaryText);
      const { deletedIds } = mgr.applyCompaction(summary);
      applyCompactionOnServer(summary, deletedIds);
      if (isDebugMode()) {
        console.info("[emma] compaction done", {
          deleted: deletedIds.length,
          summary,
        });
      }
    } catch (err) {
      console.error("[emma] compaction failed", err);
      mgr.cancelCompaction();
    }
    updateDebugStats();
  }, [applyCompactionOnServer, updateDebugStats]);

  const clearRotateTimer = useCallback(() => {
    if (rotateTimerRef.current) {
      clearTimeout(rotateTimerRef.current);
      rotateTimerRef.current = null;
    }
  }, []);

  const scheduleRotate = useCallback(() => {
    clearRotateTimer();
    const minutes = sessionMetaRef.current?.rotateMinutes ?? 5;
    rotateTimerRef.current = setTimeout(() => {
      void rotateSessionRef.current();
    }, minutes * 60 * 1000);
  }, [clearRotateTimer]);

  const teardownConnection = useCallback(
    (stopMic: boolean) => {
      clearRotateTimer();
      dcRef.current?.close();
      dcRef.current = null;

      if (pcRef.current) {
        if (stopMic) {
          pcRef.current.getSenders().forEach((sender) => sender.track?.stop());
        }
        pcRef.current.close();
      }
      pcRef.current = null;

      if (stopMic) {
        micRef.current?.getTracks().forEach((t) => t.stop());
        micRef.current = null;
      }

      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current.remove();
        audioRef.current = null;
      }

      emmaBufferRef.current = "";
      liveEmmaIdRef.current = null;
    },
    [clearRotateTimer],
  );

  const handleRealtimeEvent = useCallback(
    (raw: string) => {
      let event: RealtimeEvent;
      try {
        event = JSON.parse(raw) as RealtimeEvent;
      } catch {
        return;
      }

      const type = event.type ?? "";
      const mgr = sessionMgrRef.current;

      if (
        type === "conversation.item.created" ||
        type === "conversation.item.added"
      ) {
        const itemId = event.item_id ?? event.item?.id;
        if (itemId && event.item?.role === "assistant") {
          mgr.setPendingAssistantItemId(itemId);
        }
        return;
      }

      if (
        type === "response.output_item.done" ||
        type === "response.content_part.done"
      ) {
        const itemId = event.item_id ?? event.item?.id;
        if (itemId) mgr.setPendingAssistantItemId(itemId);
        return;
      }

      if (
        type === "response.output_audio_transcript.delta" ||
        type === "response.audio_transcript.delta"
      ) {
        emmaBufferRef.current += event.delta ?? "";
        upsertLiveEmma(emmaBufferRef.current);
        return;
      }

      if (
        type === "response.output_audio_transcript.done" ||
        type === "response.audio_transcript.done"
      ) {
        const text = event.transcript || emmaBufferRef.current;
        const itemId =
          event.item_id ?? mgr.pendingAssistantItemId ?? undefined;
        mgr.onTranscript("assistant", text, itemId ?? undefined);
        void finalizeLine("emma", text);
        void runCompaction();
        updateDebugStats();
        return;
      }

      if (type === "conversation.item.input_audio_transcription.completed") {
        const itemId = event.item_id ?? undefined;
        mgr.onTranscript("user", event.transcript ?? "", itemId);
        void finalizeLine("you", event.transcript ?? "");
        updateDebugStats();
        return;
      }

      if (type === "response.done") {
        const usage = event.response?.usage;
        if (usage) {
          mgr.onUsage(usage.input_tokens ?? 0, usage.total_tokens ?? 0);
          if (isDebugMode()) {
            console.info("[emma] response.done usage", usage);
          }
          updateDebugStats();
        }
        const outputs = event.response?.output;
        if (outputs?.[0]?.id) {
          mgr.setPendingAssistantItemId(outputs[0].id);
        }
      }
    },
    [finalizeLine, runCompaction, updateDebugStats, upsertLiveEmma],
  );

  const eventHandlerRef = useRef(handleRealtimeEvent);
  useEffect(() => {
    eventHandlerRef.current = handleRealtimeEvent;
  }, [handleRealtimeEvent]);

  const connectWebRTC = useCallback(
    async (options: {
      reuseMic?: MediaStream | null;
      continuation?: ContinuationContext | null;
      isRotate?: boolean;
    }) => {
      const { reuseMic, continuation, isRotate } = options;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      document.body.appendChild(audioEl);
      audioRef.current = audioEl;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        void audioEl.play().catch(() => {});
      };

      let mic = reuseMic ?? micRef.current;
      if (!mic) {
        mic = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        micRef.current = mic;
      }

      const micTrack = mic.getAudioTracks()[0];
      if (!micTrack) {
        throw new DOMException("Requested device not found", "NotFoundError");
      }
      pc.addTrack(micTrack);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", (e) => {
        eventHandlerRef.current(String(e.data));
      });
      dc.addEventListener("open", () => {
        createResponse();
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const requestBody = continuation
        ? JSON.stringify({ sdp: offer.sdp ?? "", continuation })
        : (offer.sdp ?? "");

      const sdpResponse = await fetch("/api/realtime/session", {
        method: "POST",
        body: requestBody,
        headers: continuation
          ? { "Content-Type": "application/json" }
          : { "Content-Type": "application/sdp" },
      });

      if (!sdpResponse.ok) {
        const errBody = await sdpResponse.json().catch(() => null);
        throw new Error(formatSessionError(errBody, sdpResponse.status));
      }

      const contentType = sdpResponse.headers.get("content-type") ?? "";
      let answerSdp: string;
      if (contentType.includes("application/json")) {
        const data = (await sdpResponse.json()) as {
          sdp?: string;
          meta?: RealtimeSessionMeta & { maxOutputTokens?: number };
        };
        answerSdp = data.sdp ?? "";
        if (data.meta) {
          sessionMetaRef.current = data.meta;
          maxOutputTokensRef.current = data.meta.maxOutputTokens ?? 50;
          if (!isRotate) {
            sessionMgrRef.current = new RealtimeSessionManager(
              data.meta.compactEveryTurns,
              data.meta.keepTurns,
            );
          }
        }
      } else {
        answerSdp = await sdpResponse.text();
      }

      if (!answerSdp) {
        throw new Error("Empty SDP answer");
      }

      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      if (isRotate) {
        segmentStartedAtRef.current = Date.now();
        scheduleRotate();
      } else if (!sessionStartedAtRef.current) {
        sessionStartedAtRef.current = Date.now();
        segmentStartedAtRef.current = Date.now();
        scheduleRotate();
      }

      setReconnecting(false);
      setStatus("talking");
    },
    [createResponse, scheduleRotate],
  );

  const rotateSession = useCallback(async () => {
    if (isRotatingRef.current || statusRef.current !== "talking") return;
    isRotatingRef.current = true;
    setReconnecting(true);

    const mgr = sessionMgrRef.current;
    try {
      const turns = mgr.allTurnsForSummary();
      let summary = mgr.summaryText ?? "";
      if (turns.length > 0) {
        summary = await fetchSummary(turns, mgr.summaryText);
      }

      const elapsedMin = segmentStartedAtRef.current
        ? Math.round((Date.now() - segmentStartedAtRef.current) / 60000)
        : undefined;

      const continuation: ContinuationContext = {
        summary: summary || "Continuing English practice.",
        topic: mgr.topicChosen,
        elapsedMin,
      };
      continuationRef.current = continuation;
      mgr.recordRotate();
      mgr.resetForNewSession(summary, mgr.topicChosen);

      teardownConnection(false);
      await connectWebRTC({
        reuseMic: micRef.current,
        continuation,
        isRotate: true,
      });

      if (isDebugMode()) {
        console.info("[emma] session rotated", continuation);
      }
    } catch (err) {
      console.error("[emma] rotate failed", err);
      setReconnecting(false);
    } finally {
      isRotatingRef.current = false;
      updateDebugStats();
    }
  }, [connectWebRTC, teardownConnection, updateDebugStats]);

  useEffect(() => {
    rotateSessionRef.current = rotateSession;
  }, [rotateSession]);

  async function startTalking() {
    setErrorMessage(null);
    if (!isRotatingRef.current) {
      setCaptions([]);
      sessionMgrRef.current = new RealtimeSessionManager();
      continuationRef.current = null;
    }
    stickToBottomRef.current = true;
    emmaBufferRef.current = "";
    liveEmmaIdRef.current = null;
    setStatus("connecting");

    try {
      if (!window.isSecureContext) {
        throw new Error(
          "Cần HTTPS để dùng mic. Deploy Vercel (https://…) hoặc tunnel HTTPS — không dùng http://IP-LAN.",
        );
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ microphone.");
      }

      await connectWebRTC({ continuation: continuationRef.current });
    } catch (err) {
      console.error(err);
      teardownConnection(true);
      setStatus("error");
      setErrorMessage(friendlyMicError(err));
    }
  }

  function stopTalking() {
    const started = sessionStartedAtRef.current;
    const durationMin = started
      ? Math.max(1, Math.round((Date.now() - started) / 60000))
      : 1;
    sessionStartedAtRef.current = null;
    segmentStartedAtRef.current = null;
    setLastDurationMin(durationMin);
    teardownConnection(true);
    setStatus("wrapup");
  }

  const isTalking = status === "talking";
  const isBusy = status === "connecting" || reconnecting;
  const showCaptions = showEn || showVi;

  if (status === "wrapup") {
    return (
      <div className={styles.wrap}>
        <SessionWrapUp
          durationMin={lastDurationMin}
          onDone={() => setStatus("idle")}
          onSkip={() => setStatus("idle")}
        />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toggles} aria-label="Phụ đề">
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showEn}
            onChange={(e) => setShowEn(e.target.checked)}
          />
          Phụ đề tiếng Anh
        </label>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={showVi}
            onChange={(e) => setShowVi(e.target.checked)}
          />
          Dịch tiếng Việt
        </label>
      </div>

      <button
        type="button"
        className={styles.button}
        disabled={isBusy}
        onClick={() => (isTalking ? stopTalking() : startTalking())}
      >
        {isBusy
          ? reconnecting
            ? "Emma đang nghe..."
            : "Đang kết nối..."
          : isTalking
            ? "Dừng"
            : "Nói chuyện với Emma"}
      </button>

      {status === "talking" && !reconnecting && (
        <p className={styles.hint}>Emma đang nghe — hãy nói tiếng Anh.</p>
      )}

      {reconnecting && <p className={styles.hint}>Emma đang nghe...</p>}

      {debugStats && <p className={styles.debug}>{debugStats}</p>}

      {showCaptions && captions.length > 0 && (
        <div
          ref={captionsRef}
          className={styles.captions}
          aria-live="polite"
          onScroll={onCaptionsScroll}
        >
          {captions.map((line) => (
            <div
              key={line.id}
              className={
                line.role === "emma" ? styles.captionEmma : styles.captionYou
              }
            >
              <span className={styles.captionWho}>
                {line.role === "emma" ? "Emma" : "Bạn"}
              </span>
              {showEn && <p className={styles.captionEn}>{line.en}</p>}
              {showVi && (
                <p className={styles.captionVi}>
                  {line.vi ?? (line.pending ? "Đang dịch…" : "")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}
    </div>
  );
}
