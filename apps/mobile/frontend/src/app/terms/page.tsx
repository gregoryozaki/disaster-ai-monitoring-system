"use client"

import Link from "next/link"

import {
  ArrowLeft,
  Database,
  FileText,
  MapPin,
  ShieldCheck,
  TriangleAlert
} from "lucide-react"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ShellHeader } from "@/components/shell-header"

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24 dark:bg-slate-950">
      <ShellHeader
        title="Termos e privacidade"
        subtitle="Uso responsável do Kamara"
      />

      <section className="space-y-4 p-5">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />

            <div>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100">
                Termos de uso
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                O Kamara é um protótipo acadêmico destinado ao registro,
                acompanhamento e apoio à análise de ocorrências ambientais e
                urbanas.
              </p>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                As informações automáticas produzidas por modelos de
                inteligência artificial são utilizadas como apoio. A decisão
                sobre confirmação, correção, rejeição ou necessidade de
                informações adicionais permanece sob responsabilidade da equipe
                humana responsável.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div>
              <h2 className="font-semibold text-amber-950">
                Situações de emergência
              </h2>

              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                O Kamara não substitui canais oficiais de emergência, segurança
                pública, defesa civil, atendimento médico ou outros serviços
                públicos responsáveis por resposta imediata.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Uso responsável
              </h2>

              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  Utilize o sistema de boa-fé e informe situações que você
                  acredita serem reais.
                </p>

                <p>
                  Não envie deliberadamente ocorrências falsas, imagens
                  enganosas ou informações destinadas a prejudicar outras
                  pessoas.
                </p>

                <p>
                  Evite incluir nas descrições ou fotografias dados pessoais que
                  não sejam necessários para compreender a ocorrência.
                </p>

                <p>
                  Você pode corrigir ou cancelar o relato original enquanto a
                  análise do gestor ainda não tiver começado. Depois da
                  intervenção humana, o registro original fica protegido e
                  eventuais informações adicionais são fornecidas por meio do
                  fluxo de complementação.
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-3">
            <Database className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" />

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Informações utilizadas
              </h2>

              <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                <p>
                  Para disponibilizar as funções do sistema, o Kamara pode
                  utilizar informações da conta, como nome e e-mail, além dos
                  dados fornecidos em uma ocorrência.
                </p>

                <p>
                  Uma ocorrência pode incluir descrição, nível de urgência
                  informado, indicação de pessoas em risco, localização,
                  fotografia, data e informações técnicas necessárias para
                  sincronização e integridade do registro.
                </p>

                <p>
                  Sessões de autenticação e registros de auditoria são
                  utilizados para controlar acesso e preservar a rastreabilidade
                  das operações relevantes.
                </p>
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />

            <div>
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                Mapa público
              </h2>

              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                O mapa público apresenta somente ocorrências que passaram pelo
                fluxo de análise e foram confirmadas. A visualização pública não
                deve expor a identidade do cidadão que realizou o registro.
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
          Esta tela apresenta a versão informativa atual dos termos do
          protótipo. O mecanismo de aceite versionado no cadastro será
          armazenado pelo sistema em etapa própria da implementação.
        </article>
      </section>

      <MobileBottomNav />
    </main>
  )
}
