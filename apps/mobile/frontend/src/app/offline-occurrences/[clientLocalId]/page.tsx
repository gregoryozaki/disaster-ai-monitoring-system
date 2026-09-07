"use client"

import Link from "next/link"

import { useCallback, useEffect, useState } from "react"

import { useParams, useRouter } from "next/navigation"

import { ArrowLeft, CloudOff, Trash2 } from "lucide-react"

import { MobileBottomNav } from "@/components/mobile-bottom-nav"

import { MobileConfirmDialog } from "@/components/mobile-confirm-dialog"

import { OccurrenceEditForm } from "@/components/occurrence-edit-form"

import { ProtectedCitizen } from "@/components/protected-citizen"

import type { UpdateOccurrencePayload } from "@/lib/api"

import {
  OFFLINE_QUEUE_CHANGED_EVENT,
  deleteOfflineOccurrence,
  getOfflineOccurrence,
  updateOfflineOccurrence,
  type OfflineOccurrenceRecord
} from "@/lib/offline-db"

import { syncOfflineOccurrence } from "@/lib/offline-sync"

export default function OfflineOccurrencePage() {
  const params = useParams<{
    clientLocalId: string
  }>()

  const router = useRouter()

  const clientLocalId = params.clientLocalId

  const [record, setRecord] = useState<OfflineOccurrenceRecord | null>(null)

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [deleting, setDeleting] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const current = await getOfflineOccurrence(clientLocalId)

      if (!current) {
        setRecord(null)

        setMessage("Este registro não está mais disponível para edição local.")

        return
      }

      /*
       * Se a ocorrência já recebeu um ID
       * do servidor, as regras locais
       * deixam de ser a autoridade.
       *
       * O usuário deve ser levado ao
       * detalhe remoto, onde canEdit e
       * canDelete são calculados pela API.
       */
      if (current.serverOccurrenceId) {
        router.replace(`/occurrences/${current.serverOccurrenceId}`)

        return
      }

      setRecord(current)

      setMessage(null)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível abrir este registro."
      )
    } finally {
      setLoading(false)
    }
  }, [clientLocalId, router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    function handleQueueChanged() {
      void load()
    }

    window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged)

    return () => {
      window.removeEventListener(
        OFFLINE_QUEUE_CHANGED_EVENT,
        handleQueueChanged
      )
    }
  }, [load])

  async function save(payload: UpdateOccurrencePayload, photo: File | null) {
    if (
      !record ||
      record.serverOccurrenceId ||
      record.syncStatus === "SYNCING"
    ) {
      return
    }

    if (
      payload.description === undefined ||
      payload.urgency === undefined ||
      payload.humanRisk === undefined ||
      payload.latitude === undefined ||
      payload.longitude === undefined ||
      payload.locationSource === undefined
    ) {
      setMessage("Não foi possível validar as alterações deste registro.")

      return
    }

    setSaving(true)

    setMessage(null)

    try {
      await updateOfflineOccurrence(record.clientLocalId, {
        description: payload.description,

        urgency: payload.urgency,

        humanRisk: payload.humanRisk,

        latitude: payload.latitude,

        longitude: payload.longitude,

        locationSource: payload.locationSource,

        ...(payload.locationAccuracyM === null
          ? {
              locationAccuracyM: undefined
            }
          : payload.locationAccuracyM !== undefined
            ? {
                locationAccuracyM: payload.locationAccuracyM
              }
            : {}),

        /*
         * Se uma nova foto foi escolhida,
         * substituímos diretamente a foto
         * pendente no IndexedDB.
         *
         * A foto antiga não será mais
         * enviada quando a sincronização
         * acontecer.
         */
        ...(photo
          ? {
              photo: {
                blob: photo,

                name: photo.name,

                type: photo.type,

                lastModified: photo.lastModified
              }
            }
          : {}),

        syncStatus: "PENDING_SYNC",

        attemptCount: 0,

        lastAttemptAt: null,

        lastError: null
      })

      /*
       * Se a conexão voltou enquanto o
       * usuário editava, já tentamos
       * sincronizar o registro atualizado.
       */
      if (navigator.onLine) {
        const result = await syncOfflineOccurrence(record.clientLocalId, {
          force: true
        })

        if (result.status === "SYNCED" && result.occurrenceId) {
          router.replace(`/occurrences/${result.occurrenceId}`)

          return
        }
      }

      router.replace("/history")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações."
      )
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (
      !record ||
      record.serverOccurrenceId ||
      record.syncStatus === "SYNCING"
    ) {
      return
    }

    setDeleting(true)

    setMessage(null)

    try {
      await deleteOfflineOccurrence(record.clientLocalId)

      router.replace("/history")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível cancelar este registro."
      )

      setDeleteDialogOpen(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ProtectedCitizen nextPath={`/offline-occurrences/${clientLocalId}`}>
      <main className="mx-auto min-h-screen max-w-md bg-slate-50 pb-24">
        <header className="border-b border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <Link
              href="/history"
              aria-label="Voltar"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>

            <div>
              <h1 className="font-semibold text-slate-900">Editar registro</h1>

              <p className="text-xs text-slate-500">
                Este registro ainda não foi enviado
              </p>
            </div>
          </div>
        </header>

        <section className="space-y-4 p-4">
          {message && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {message}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
              Carregando registro...
            </div>
          )}

          {record && record.syncStatus === "SYNCING" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              O envio está em andamento. Aguarde a conclusão antes de tentar
              alterar este registro.
            </div>
          )}

          {record && record.syncStatus !== "SYNCING" && (
            <>
              <article className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div>
                  <p className="text-sm font-semibold text-amber-950">
                    Registro ainda não enviado
                  </p>

                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    Como este registro ainda não chegou à análise do gestor,
                    você pode corrigir as informações, trocar a foto ou
                    cancelá-lo.
                  </p>
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <OccurrenceEditForm
                  initialDescription={record.description}
                  initialUrgency={record.urgency}
                  initialHumanRisk={record.humanRisk}
                  initialLocation={{
                    latitude: record.latitude,

                    longitude: record.longitude,

                    source: record.locationSource,

                    accuracyM: record.locationAccuracyM ?? null
                  }}
                  hasCurrentPhoto={Boolean(record.photo)}
                  currentPhotoName={record.photo?.name ?? null}
                  submitting={saving}
                  onSubmit={save}
                  onCancel={() => router.push("/history")}
                />
              </article>

              <button
                type="button"
                onClick={() => setDeleteDialogOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Cancelar este registro
              </button>
            </>
          )}

          {!loading && !record && (
            <Link
              href="/history"
              className="block rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white"
            >
              Voltar ao histórico
            </Link>
          )}
        </section>

        <MobileBottomNav />

        <MobileConfirmDialog
          open={deleteDialogOpen}
          title="Cancelar este registro?"
          description="Como ele ainda não foi enviado, o registro será removido deste aparelho e não será enviado posteriormente."
          confirmLabel="Cancelar registro"
          submitting={deleting}
          danger
          onClose={() => setDeleteDialogOpen(false)}
          onConfirm={() => void remove()}
        >
          <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-800">
            Essa ação remove o registro pendente e a foto associada da fila
            local. Ela não poderá ser desfeita pelo aplicativo.
          </p>
        </MobileConfirmDialog>
      </main>
    </ProtectedCitizen>
  )
}
