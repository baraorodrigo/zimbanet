"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import Icon from "./icon";
import {
  signInWithGoogle,
  sendEmailMagicLink,
  sendPhoneOtp,
  verifyPhoneOtp,
  type AuthResult,
} from "@/lib/actions/auth";
import { closeLoginHref, readLoginParams } from "@/lib/auth/login-url";

type Step = "choices" | "email" | "phone-send" | "phone-verify";

// === Server action wrappers pra useFormState ===============================

type EmailState = AuthResult | null;
async function emailAction(_prev: EmailState, formData: FormData): Promise<EmailState> {
  return await sendEmailMagicLink(formData);
}

type PhoneSendState = AuthResult | null;
async function phoneSendAction(
  _prev: PhoneSendState,
  formData: FormData,
): Promise<PhoneSendState> {
  return await sendPhoneOtp(formData);
}

type PhoneVerifyState = AuthResult | null;
async function phoneVerifyAction(
  _prev: PhoneVerifyState,
  formData: FormData,
): Promise<PhoneVerifyState> {
  return await verifyPhoneOtp(formData);
}

// === Componente principal ===================================================

export default function AuthModal() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { open, next } = readLoginParams(search);

  // Não monta nada se admin (paranoia — site-header já não inclui modal lá,
  // mas garante caso seja montado por engano).
  if (pathname?.startsWith("/admin") || pathname?.startsWith("/login")) {
    return null;
  }

  if (!open) return null;

  function close() {
    router.replace(closeLoginHref(pathname ?? "/", search), { scroll: false });
  }

  return <ModalShell onClose={close} next={next} />;
}

function ModalShell({ onClose, next }: { onClose: () => void; next: string }) {
  const [step, setStep] = useState<Step>("choices");
  const [phoneTyped, setPhoneTyped] = useState("");

  // Esc fecha
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-navy/70 backdrop-blur-sm cursor-default"
      />

      {/* Card */}
      <div className="relative w-full max-w-[440px] bg-white rounded-md shadow-z-3 overflow-hidden">
        <header className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-border-subtle">
          <p
            id="auth-modal-title"
            className="font-sans text-[10px] font-bold uppercase tracking-[0.24em] text-zimba-gold"
          >
            Entrar no ZIMBANET
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-navy transition-colors -mr-1 p-1"
            aria-label="Fechar"
          >
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="px-6 py-5">
          {step === "choices" && (
            <ChoicesStep
              next={next}
              onPickEmail={() => setStep("email")}
              onPickPhone={() => setStep("phone-send")}
            />
          )}
          {step === "email" && <EmailStep next={next} onBack={() => setStep("choices")} />}
          {step === "phone-send" && (
            <PhoneSendStep
              phoneTyped={phoneTyped}
              setPhoneTyped={setPhoneTyped}
              onSent={() => setStep("phone-verify")}
              onBack={() => setStep("choices")}
            />
          )}
          {step === "phone-verify" && (
            <PhoneVerifyStep
              phone={phoneTyped}
              next={next}
              onBack={() => setStep("phone-send")}
            />
          )}
        </div>

        <footer className="px-6 py-3 bg-ink-50 border-t border-border-subtle text-[11px] leading-relaxed text-ink-500">
          Sem cadastro chato. A gente usa só pra confirmar quem postou.
        </footer>
      </div>
    </div>
  );
}

// === Steps ===================================================================

function ChoicesStep({
  next,
  onPickEmail,
  onPickPhone,
}: {
  next: string;
  onPickEmail: () => void;
  onPickPhone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function googleSubmit() {
    startTransition(async () => {
      await signInWithGoogle(next);
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-fs-14 text-ink-700 leading-relaxed">
        Entra rapidinho pra postar no <strong className="text-navy">#zimbamilgrau</strong> ou
        anunciar no <strong className="text-navy">#bazardazimba</strong>.
      </p>

      <button
        type="button"
        onClick={googleSubmit}
        disabled={isPending}
        className="w-full h-12 rounded-md border-2 border-navy bg-navy text-off-white hover:bg-zimba-blue hover:border-zimba-blue transition-colors flex items-center justify-center gap-3 font-display font-bold text-fs-15 disabled:opacity-60"
      >
        <GoogleMark />
        {isPending ? "Abrindo Google…" : "Entrar com Google"}
      </button>

      <div className="flex items-center gap-3" role="separator">
        <span className="h-px flex-1 bg-border-subtle" />
        <span className="text-[10px] uppercase tracking-[0.28em] font-bold text-ink-400">
          ou
        </span>
        <span className="h-px flex-1 bg-border-subtle" />
      </div>

      <button
        type="button"
        onClick={onPickEmail}
        className="w-full h-12 rounded-md border border-border-subtle bg-white hover:border-navy text-navy font-display font-bold text-fs-14 flex items-center justify-center gap-2 transition-colors"
      >
        <Icon name="mail" size={16} />
        Entrar por email (link mágico)
      </button>

      <button
        type="button"
        onClick={onPickPhone}
        className="w-full h-12 rounded-md border border-border-subtle bg-white hover:border-navy text-navy font-display font-bold text-fs-14 flex items-center justify-center gap-2 transition-colors"
      >
        <Icon name="phone" size={16} />
        Entrar por SMS
      </button>
    </div>
  );
}

function EmailStep({ next, onBack }: { next: string; onBack: () => void }) {
  const [state, formAction] = useFormState<EmailState, FormData>(emailAction, null);
  const sentTo = state && state.ok && typeof state.data?.email === "string"
    ? (state.data.email as string)
    : null;
  const error = state && state.ok === false ? state.error : null;

  if (sentTo) {
    return (
      <div className="rounded-md border-2 border-eco-green bg-eco-green/5 p-5 text-center space-y-2">
        <p className="font-display font-bold text-fs-16 text-navy">Confere seu email.</p>
        <p className="text-fs-13 text-ink-700">
          Mandei um link mágico pra <span className="font-semibold text-navy">{sentTo}</span>.
          Clica nele em até 1h pra entrar.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy"
        >
          ← Voltar
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-fs-13 font-semibold text-navy mb-1.5 block">Seu email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="voce@email.com"
          className="w-full h-12 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
        />
      </label>

      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}

      <EmailSubmitButton />

      <button
        type="button"
        onClick={onBack}
        className="w-full text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy py-1"
      >
        ← Outras opções
      </button>
    </form>
  );
}

function EmailSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-14 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60"
    >
      {pending ? "Enviando…" : "Enviar link mágico"}
    </button>
  );
}

function PhoneSendStep({
  phoneTyped,
  setPhoneTyped,
  onSent,
  onBack,
}: {
  phoneTyped: string;
  setPhoneTyped: (v: string) => void;
  onSent: () => void;
  onBack: () => void;
}) {
  const [state, formAction] = useFormState<PhoneSendState, FormData>(phoneSendAction, null);

  useEffect(() => {
    if (state?.ok) onSent();
  }, [state, onSent]);

  const error = state && state.ok === false ? state.error : null;

  return (
    <form action={formAction} className="space-y-3">
      <label className="block">
        <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
          Celular (com DDD)
        </span>
        <input
          type="tel"
          name="phone"
          required
          autoFocus
          inputMode="tel"
          autoComplete="tel-national"
          value={phoneTyped}
          onChange={(e) => setPhoneTyped(e.target.value)}
          placeholder="(48) 99999-9999"
          className="w-full h-12 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-15 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
        />
      </label>
      <p className="text-[11px] text-ink-500">Vamos te mandar um código por SMS.</p>

      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}

      <PhoneSendButton />

      <button
        type="button"
        onClick={onBack}
        className="w-full text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy py-1"
      >
        ← Outras opções
      </button>
    </form>
  );
}

function PhoneSendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-14 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60"
    >
      {pending ? "Enviando SMS…" : "Enviar código"}
    </button>
  );
}

function PhoneVerifyStep({
  phone,
  next,
  onBack,
}: {
  phone: string;
  next: string;
  onBack: () => void;
}) {
  const [state, formAction] = useFormState<PhoneVerifyState, FormData>(
    phoneVerifyAction,
    null,
  );
  const error = state && state.ok === false ? state.error : null;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="phone" value={phone} />
      <input type="hidden" name="next" value={next} />

      <div className="rounded-md border border-border-subtle bg-ink-50 p-3 text-fs-12 text-ink-700">
        Código enviado pra <span className="font-semibold text-navy">{phone}</span>.
      </div>

      <label className="block">
        <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
          Código de 6 dígitos
        </span>
        <input
          type="text"
          name="token"
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4,8}"
          maxLength={8}
          placeholder="123456"
          className="w-full h-14 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-22 tracking-[0.4em] text-navy text-center font-display font-bold placeholder:text-ink-300 focus:border-zimba-gold focus:outline-none"
        />
      </label>

      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}

      <PhoneVerifyButton />

      <button
        type="button"
        onClick={onBack}
        className="w-full text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy py-1"
      >
        ← Trocar número
      </button>
    </form>
  );
}

function PhoneVerifyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-14 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60"
    >
      {pending ? "Conferindo…" : "Confirmar e entrar"}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.1 29.5 4 24 4c-7.7 0-14.4 4.4-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 14-5.4l-6.5-5.5C29.5 34.7 26.9 36 24 36c-5.3 0-9.7-3.4-11.3-8L6 33.1C9.3 39.5 16 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.5 5.5C42 35.6 44 30.3 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}
