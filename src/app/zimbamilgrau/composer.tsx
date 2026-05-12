"use client";

import { useFormState, useFormStatus } from "react-dom";
import Icon from "@/components/icon";
import { createMuralPost, type ActionResult } from "@/lib/actions/community";
import { ImagePicker } from "@/components/image-picker";

const bairros = [
  "Centro",
  "Vila Nova",
  "Praia da Vila",
  "Itapirubá",
  "Mirim",
  "Nova Brasília",
  "Alto Arroio",
  "Guarda do Embaú",
  "Sambaqui",
  "Arroio",
  "Outro / não listado",
];

type State = ActionResult<{ id: string; status: "published" | "pending_confirmation" }> | null;

async function submit(_prev: State, formData: FormData): Promise<State> {
  return await createMuralPost(formData);
}

function PublishButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { pending } = useFormStatus();
  const idleLabel = isLoggedIn ? "Publicar" : "Publicar e confirmar";
  const pendingLabel = isLoggedIn ? "Publicando…" : "Enviando link…";
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-zimba-gold text-navy text-[11px] uppercase tracking-[0.24em] font-bold px-6 h-10 inline-flex items-center hover:bg-navy hover:text-zimba-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

type Props = {
  initials?: string;
  isLoggedIn: boolean;
};

export default function MuralComposer({ initials = "VC", isLoggedIn }: Props) {
  const [state, formAction] = useFormState<State, FormData>(submit, null);
  const errorMsg = state && state.ok === false ? state.error : null;
  const ok = state && state.ok === true;
  const pendingConfirm = ok && state.data?.status === "pending_confirmation";

  return (
    <form
      action={formAction}
      className="-mt-10 relative z-10 mb-8 rounded-md bg-white border border-border-subtle shadow-z-2 p-5 lg:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-full bg-navy text-zimba-gold font-display font-black text-[15px] flex items-center justify-center shrink-0">
          {isLoggedIn ? initials : "?"}
        </div>
        <div className="flex-1 min-w-0">
          <textarea
            name="body"
            required
            minLength={1}
            maxLength={1200}
            rows={2}
            placeholder="O que rola em Imbituba? Reclamação, achado, dica, denúncia — solta aqui."
            className="w-full resize-none bg-transparent outline-none text-fs-15 text-navy placeholder:text-ink-400 leading-relaxed"
          />

          <div className="mt-3 pt-3 border-t border-border-subtle">
            <ImagePicker
              name="media_url"
              scope="mural"
              label="Foto ou print (opcional)"
              hint="Buraco na rua, lambança na praia, achado da feira. Solte um arquivo ou cole uma URL."
              aspect="wide"
            />
          </div>

          {!isLoggedIn && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.22em] font-bold text-ink-500 block mb-1.5">
                  Seu email (pra confirmar o post)
                </span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  placeholder="voce@email.com"
                  className="w-full h-10 rounded-md border border-border-subtle bg-white px-3 text-fs-14 text-navy placeholder:text-ink-400 focus:border-zimba-gold focus:outline-none"
                />
              </label>
              <p className="mt-1.5 text-[11px] text-ink-500">
                Sem cadastro. Mandamos um link, você clica e o post entra no ar.
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border-subtle">
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-tag font-bold text-ink-500">
              <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-navy">
                <Icon name="map-pin" size={13} />
                <select
                  name="bairro"
                  required
                  defaultValue=""
                  className="bg-transparent outline-none text-[11px] uppercase tracking-tag font-bold cursor-pointer"
                >
                  <option value="" disabled>
                    Bairro
                  </option>
                  {bairros.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-ink-300">·</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer hover:text-navy">
                <input type="checkbox" name="is_anon" className="accent-zimba-gold" />
                Postar anônimo
              </label>
            </div>
            <PublishButton isLoggedIn={isLoggedIn} />
          </div>

          {errorMsg && (
            <p className="mt-3 text-fs-13 text-alert-red">{errorMsg}</p>
          )}
          {ok && !pendingConfirm && (
            <p className="mt-3 text-fs-13 text-eco-green">
              No ar! Vai aparecer no mural em segundos.
            </p>
          )}
          {pendingConfirm && (
            <div className="mt-3 rounded-md border border-eco-green bg-eco-green/5 p-3 text-fs-13 text-eco-green">
              <strong className="font-display">Quase lá!</strong> Mandei um link
              pro seu email. Clica nele pra publicar — válido por 1h. Depois disso
              você nem precisa logar pra postar de novo.
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
