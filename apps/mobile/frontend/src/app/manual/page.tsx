"use client"

import Link from "next/link"

import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudOff,
  History,
  Map,
  MessageSquareMore,
  Pencil,
  ShieldCheck
} from "lucide-react"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { ShellHeader } from "@/components/shell-header"

export default function ManualPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24 dark:bg-slate-950">
      <ShellHeader
        title="Manual do usuário"
        subtitle="Como utilizar o Kamara"
      />

      <section className="space-y-4 p-5">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <ManualCard icon={Camera} title="1. Registrar uma ocorrência">
          Adicione uma fotografia se desejar, descreva o que está acontecendo,
          informe a urgência e se existem pessoas em risco. Depois indique o
          local usando a localização do aparelho ou selecionando o ponto no
          mapa.
        </ManualCard>

        <ManualCard icon={CheckCircle2} title="2. Revisar antes de registrar">
          Antes da criação do registro, o Kamara mostra uma revisão com a
          descrição, urgência, risco humano, fotografia e forma usada para
          definir o local. A ocorrência só é registrada depois da confirmação.
        </ManualCard>

        <ManualCard icon={CloudOff} title="3. Registrar sem internet">
          Se a conexão estiver indisponível, o registro pode permanecer salvo
          localmente no aparelho. Quando a conexão retornar, o sistema tenta
          sincronizar as informações com o servidor.
        </ManualCard>

        <ManualCard icon={Pencil} title="4. Corrigir ou cancelar">
          Enquanto a análise do gestor ainda não tiver começado, você pode
          alterar a descrição, urgência, risco humano, localização e fotografia.
          Também pode cancelar o registro.
        </ManualCard>

        <ManualCard icon={History} title="5. Acompanhar pelo histórico">
          O Histórico reúne suas ocorrências e mostra o estado atual de cada
          uma. Toque em um registro para consultar detalhes, fotografias e o
          andamento da análise.
        </ManualCard>

        <ManualCard
          icon={MessageSquareMore}
          title="6. Responder a pedidos de informação"
        >
          Se a equipe responsável precisar de mais dados, a ocorrência ficará
          marcada como necessitando de informações. Abra o registro e envie a
          resposta solicitada, com texto, fotografia ou ambos.
        </ManualCard>

        <ManualCard icon={Map} title="7. Consultar ocorrências próximas">
          A tela inicial utiliza a localização fornecida pelo aparelho para
          centralizar o mapa e consultar ocorrências confirmadas dentro do raio
          configurado. Se a localização automática estiver incorreta, o registro
          de uma nova ocorrência também permite selecionar manualmente o local
          no mapa.
        </ManualCard>

        <ManualCard icon={ShieldCheck} title="8. Entender a análise">
          O sistema pode produzir classificações automáticas para apoiar o
          trabalho da equipe responsável, mas a confirmação final da ocorrência
          é humana.
        </ManualCard>

        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
          O Kamara não substitui serviços oficiais de emergência ou resposta
          imediata.
        </article>
      </section>

      <MobileBottomNav />
    </main>
  )
}

function ManualCard({
  icon: Icon,
  title,
  children
}: {
  icon: typeof Camera

  title: string

  children: React.ReactNode
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <Icon className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {children}
          </p>
        </div>
      </div>
    </article>
  )
}
