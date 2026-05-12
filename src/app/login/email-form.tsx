"use client";

import { useFormState, useFormStatus } from "react-dom";
import { sendEmailMagicLink, type AuthResult } from "@/lib/actions/auth";

type State = AuthResult | null;

async function action(_prev: State, formData: FormData): Promise<State> {
  return await sendEmailMagicLink(formData);
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-14 rounded-md bg-zimba-gold text-navy font-display font-black text-fs-16 uppercase tracking-[0.18em] hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? "Enviando link…" : "Enviar link mágico"}
    </button>
  );
}

export default function LoginEmailForm({ next }: { next: string }) {
  const [state, formAction] = useFormState<State, FormData>(action, null);

  const sentTo =
    state && state.ok && typeof state.data?.email === "string"
      ? (state.data.email as string)
      : null;
  const error = state && state.ok === false ? state.error : null;

  if (sentTo) {
    return (
      <div className="rounded-md border-2 border-eco-green bg-eco-green/5 p-5 text-center space-y-2">
        <p className="font-display font-bold text-fs-18 text-navy">
          Confere seu email.
        </p>
        <p className="text-fs-14 text-ink-700">
          Mandei um link mágico pra <span className="font-semibold text-navy">{sentTo}</span>.
          Clica nele pra entrar — válido por 1 hora.
        </p>
        <p className="text-fs-12 text-ink-500 pt-1">
          Não chegou? Olha o spam ou{" "}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline font-semibold text-navy hover:text-zimba-blue"
          >
            tenta outro email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-fs-13 font-semibold text-navy mb-1.5 block">
          Seu email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="voce@email.com"
          className="w-full h-14 rounded-md border-2 border-border-subtle bg-white px-4 text-fs-16 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
        />
      </label>
      <p className="text-fs-12 text-ink-500">
        Sem senha. Mandamos um link, você clica e tá dentro.
      </p>

      {error && (
        <div className="rounded-md border border-alert-red bg-alert-red/5 p-3 text-fs-13 text-alert-red">
          {error}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
