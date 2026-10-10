/**
 * <design_plan>
 * 1. RNG (seed = ConsultationsDetail char count % 101): 2 mock random.choice() lines
 *    picking hero/component/GSAP/font selections — obey them literally.
 * 2. AIDA check: Header draws Attention, symptom_summary builds Interest,
 *    chat scroll-to-Action, composer sends Action.
 * 3. Container math: max-w-2xl on header, w-full on chat list, gap-6 between
 *    message bubbles — zero empty cells in the bento.
 * 4. Bento density: 2-column layout (header + chat area), grid-flow-dense,
 *    no empty cells between header and chat.
 * 5. Label sweep: no meta-labels, no emoji, button text contrast verified.
 * </design_plan>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mic,
} from "lucide-react";

import { useAppShell } from "@/state/app-shell.tsx";
import { Badge, SectionHeader } from "@/components/ui.tsx";
import { initialsOf } from "@/domain/profile.ts";
import { fetchConsultation, sendConsultationMessage } from "@/api/consultations.ts";
import type { Consultation, ConsultationMessage, DoctorCard } from "@/domain/types.ts";
import { DomainError } from "@/domain/types.ts";
import { lookup } from "@/lib/strings.ts";

const ConsultationsDetail = () => {
  const { t, lang, isBn } = useAppShell();
  const { id } = useParams<{ id: string }>();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<ConsultationMessage[]>([]);
  const [doctor, setDoctor] = useState<DoctorCard | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchConsultation(id).then((data) => {
      if (!data) {
        setError(t("errors.notFound"));
        return;
      }
      setConsultation(data.consultation);
      setMessages(data.messages);
      setDoctor(data.doctor);
    });
  }, [id, t]);

  const scrollToBottom = useCallback(() => {
    messagesRef.current?.scrollTo({ top: Number.POSITIVE_INFINITY, behavior: "smooth" });
  }, []);

  const sendMessage = async (body: string) => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    const newMessage: ConsultationMessage = {
      id: `msg-${Date.now()}`,
      consultation_id: id!,
      sender_id: "demo-self",
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");

    try {
      await sendConsultationMessage(id!, body);
      scrollToBottom();
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== newMessage.id));
      setError(err instanceof DomainError ? err.bilingual[lang] : t("errors.generic"));
    } finally {
      setSending(false);
    }
  };

  if (!consultation || !doctor) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 pb-24" role="status" aria-live="polite">
        <div className="rounded-2xl border border-blood-soft bg-blood-soft/60 px-5 py-8 text-center">
          <p className="text-sm text-blood-deep">{error ?? t("errors.notFound")}</p>
          <Link
            to="/consultations"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-deep hover:text-brand"
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {t("common.back")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden w-full max-w-7xl mx-auto px-4 sm:px-6 pb-24">
      <SectionHeader
        eyebrow={t("doctors.title")}
        title={doctor.display_name}
        body={doctor.specialty_bn || doctor.specialty_en || ""}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-8">
        {/* Doctor header card */}
        <div className="sm:col-span-1">
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-elevated text-ink">
                {initialsOf(doctor.full_name) || "•"}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-semibold text-ink">
                  {doctor.full_name}
                </h2>
                <p className="text-sm text-muted">
                  {doctor.degrees || ""}
                  {doctor.specialty_en && doctor.specialty_bn && (
                    <>
                      {lang === "bn" ? ` ({doctor.specialty_bn})` : ` ({doctor.specialty_en})`}
                    </>
                  )}
                  {doctor.experience_years && (
                    <span className="text-subtle">
                      {doctor.experience_years} {t("doctors.years")}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="brand">
                  {doctor.consult_fee === 0 ? t("doctors.free") : `$${doctor.consult_fee}`}
                </Badge>
                {doctor.status && (
                  <Badge tone="muted">{t(`consultation.statuses.${doctor.status}`)}</Badge>
                )}
              </div>
            </div>

            {/* Symptom summary */}
            {consultation.symptom_summary && (
              <div className="mt-6 pt-6 border-t border-line">
                <p className="text-sm text-muted">{t("consultation.symptom_summary")}:</p>
                <p className="mt-2 break-all text-ink">{consultation.symptom_summary}</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="sm:col-span-1">
          <div className="rounded-3xl border border-line bg-surface p-6 sm:p-6" role="region" aria-label="consultation chat">
            <div className="h-[320px] overflow-y-auto rounded-b-3xl bg-elevated p-4" ref={messagesRef} aria-live="polite">
              {messages.map((msg) => {
                const isMine = msg.sender_id === "demo-self";
                const timestamp = msg.created_at
                  ? new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(msg.created_at))
                  : "";

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"} mb-4 ${isMine ? "bg-brand text-white" : "bg-elevated text-ink"}`}
                  >
                    <div className={`max-w-2/3 px-4 py-2 rounded ${isMine ? "rounded-tr" : "rounded-tl"} ${isMine ? "rounded-bl" : "rounded-br"}`}>
                      <p className="text-sm line-clamp-4">{msg.body}</p>
                    </div>
                    <div className="text-xs text-subtle">{timestamp}</div>
                  </div>
                );
              })}

              {loading && (
                <div className="h-10 w-2/3 animate-pulse rounded bg-elevated m-2" />
              )}

              {error && (
                <div className="mt-3 rounded-2xl border border-blood-soft bg-blood-soft/60 px-4 py-3 text-sm text-blood-deep">
                  {error}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="mt-4 flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("common.message")}
                rows={1}
                disabled={sending}
                className="flex-1 rounded-t-lg border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed h-14 p-3 resize-none"
                aria-label="message input"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={sending}
                className="rounded-full h-11 bg-brand text-white px-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                aria-disabled={sending}
                aria-label={sending ? t("common.loading") : t("doctors.audioSoon")}
              >
                {sending ? t("common.loading") : t("common.send")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Audio call stub */}
      <div className="mt-6 text-center">
        <button
          disabled
          aria-disabled="true"
          className="rounded-full border border-line bg-surface text-subtle px-6 py-2 text-sm font-semibold"
          aria-label={t("doctors.audioSoon")}
        >
          {t("doctors.audioSoon")}
        </button>
      </div>
    </div>
  );
};

export default ConsultationsDetail;