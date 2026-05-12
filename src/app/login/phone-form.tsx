"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { sendPhoneOtp, verifyPhoneOtp, type AuthResult } from "@/lib/actions/auth";

type SendState = AuthResult | null;
type VerifyState = AuthResult | null;

async function sendAction(_prev: SendState, formData: FormData): Promise<SendState> {
  return await sendPhoneOtp(formData);
}

async function verifyAction(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  return await verifyPhoneOtp(formData);
}

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-16 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Enviando SMS…" : "Enviar código"}
    </button>
  );
}

function VerifyButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-16 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Conferindo…" : "Confirmar e entrar"}
    </button>
  );
}

export default function LoginPhoneForm({ next }: { next: string }) {
  const [phoneTyped, setPhoneTyped] = useState("");
  const [sendState, sendFormAction] = useFormState<SendState, FormData>(sendAction, null);
  const [verifyState, verifyFormAction] = useFormState<VerifyState, FormData>(verifyAction, null);

  const sentTo =
    sendState && sendState.ok && typeof sendState.data?.phone === "string"
      ? (sendState.data.phone as string)
      : null;
  const sendError = sendState && sendState.ok === false ? sendState.error : null;
  const verifyError = verifyState && verifyState.ok === false ? verifyState.error : null;

  // Estágio 1: enviar SMS
  if (!sentTo) {
    return (
      <form action={sendFormAction} className="space-y-4">
        <label className="block">
          <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
            Celular (com DDD)
          </span>
          <input
            type="tel"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel-national"
            value={phoneTyped}
            onChange={(e) => setPhoneTyped(e.target.value)}
            placeholder="(48) 99999-9999"
            className="w-full h-14 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-16 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
          />
        </label>
        <p className="text-fs-12 text-ink-500">
          Vamos te mandar um código de 6 dígitos por SMS. Pode levar uns segundos.
        </p>

        {sendError && (
          <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
            {sendError}
          </div>
        )}

        <SendButton />
      </form>
    );
  }

  // Estágio 2: verificar código
  return (
    <form action={verifyFormAction} className="space-y-4">
      <input type="hidden" name="phone" value={phoneTyped} />
      <input type="hidden" name="next" value={next} />

      <div className="rounded-md border border-border-subtle bg-ink-50 p-4 text-fs-13 text-ink-700">
        Código enviado pra{" "}
        <span className="font-semibold text-navy">{maskPhone(sentTo)}</span>.
        Cheque seu SMS.
      </div>

      <label className="block">
        <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
          Código de 6 dígitos
        </span>
        <input
          type="text"
          name="token"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{4,8}"
          maxLength={8}
          placeholder="123456"
          className="w-full h-14 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-22 tracking-[0.4em] text-navy text-center font-display font-bold placeholder:text-ink-300 focus:border-zimba-gold focus:outline-none"
        />
      </label>

      {verifyError && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {verifyError}
        </div>
      )}

      <VerifyButton />

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="w-full text-fs-12 uppercase tracking-[0.22em] font-bold text-ink-500 hover:text-navy py-2"
      >
        Trocar número
      </button>
    </form>
  );
}

function maskPhone(e164: string) {
  // +5548999998888 -> +55 (48) 9XXXX-8888
  const m = e164.match(/^\+55(\d{2})(\d{4,5})(\d{4})$/);
  if (!m) return e164;
  const [, ddd, mid, last] = m;
  const hidden = "X".repeat(Math.max(0, mid.length - 1));
  return `+55 (${ddd}) ${mid[0]}${hidden}-${last}`;
}
