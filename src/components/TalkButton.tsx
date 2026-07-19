"use client";

import { useCallback, useRef, useState } from "react";
import styles from "./TalkButton.module.css";

type Status = "idle" | "connecting" | "talking" | "error";

type CaptionLine = {
  id: string;
  role: "emma" | "you";
  en: string;
  vi?: string;
  pending?: boolean;
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

export default function TalkButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEn, setShowEn] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const emmaBufferRef = useRef("");
  const liveEmmaIdRef = useRef<string | null>(null);
  const showViRef = useRef(showVi);
  showViRef.current = showVi;

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

  function handleRealtimeEvent(raw: string) {
    let event: {
      type?: string;
      delta?: string;
      transcript?: string;
    };
    try {
      event = JSON.parse(raw) as typeof event;
    } catch {
      return;
    }

    const type = event.type ?? "";

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
      void finalizeLine("emma", event.transcript || emmaBufferRef.current);
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      void finalizeLine("you", event.transcript ?? "");
    }
  }

  async function startTalking() {
    setErrorMessage(null);
    setCaptions([]);
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

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "true");
      document.body.appendChild(audioEl);
      audioRef.current = audioEl;
      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        void audioEl.play().catch(() => {
          /* autoplay may be blocked; user already tapped */
        });
      };

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micRef.current = mic;
      const micTrack = mic.getAudioTracks()[0];
      if (!micTrack) {
        throw new DOMException("Requested device not found", "NotFoundError");
      }
      pc.addTrack(micTrack);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", (e) => {
        handleRealtimeEvent(String(e.data));
      });
      dc.addEventListener("open", () => {
        dc.send(JSON.stringify({ type: "response.create" }));
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("/api/realtime/session", {
        method: "POST",
        body: offer.sdp ?? "",
        headers: { "Content-Type": "application/sdp" },
      });

      if (!sdpResponse.ok) {
        const errBody = await sdpResponse.json().catch(() => null);
        throw new Error(formatSessionError(errBody, sdpResponse.status));
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("talking");
    } catch (err) {
      console.error(err);
      stopTalking();
      setStatus("error");
      setErrorMessage(friendlyMicError(err));
    }
  }

  function stopTalking() {
    dcRef.current?.close();
    dcRef.current = null;

    pcRef.current?.getSenders().forEach((sender) => sender.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;

    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;

    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current.remove();
      audioRef.current = null;
    }

    emmaBufferRef.current = "";
    liveEmmaIdRef.current = null;
    setStatus("idle");
  }

  const isTalking = status === "talking";
  const isBusy = status === "connecting";
  const showCaptions = showEn || showVi;

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
          ? "Đang kết nối..."
          : isTalking
            ? "Dừng"
            : "Nói chuyện với Emma"}
      </button>

      {status === "talking" && (
        <p className={styles.hint}>Emma đang nghe — hãy nói tiếng Anh.</p>
      )}

      {showCaptions && captions.length > 0 && (
        <div className={styles.captions} aria-live="polite">
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
