"use client"

import { useState } from "react"

import { useRouter } from "next/navigation"

import { useCitizenSession } from "@/components/citizen-session-provider"

import { MobileConfirmDialog } from "@/components/mobile-confirm-dialog"

import { listOfflineOccurrences } from "@/lib/offline-db"

function pendingDescription(count: number, agreementRequired: boolean) {
  const summary =
    count === 1
      ? "Há 1 ocorrência salva neste aparelho que ainda não foi enviada. Se você sair agora, ela será apagada."
      : `Há ${count} ocorrências salvas neste aparelho que ainda não foram enviadas. Se você sair agora, elas serão apagadas.`

  // Com aceite pendente, o envio só volta depois de aceitar os termos.
  const howToKeep = agreementRequired
    ? "Para enviá-las, conecte-se à internet e aceite os termos antes de sair."
    : "Para não perder, conecte-se à internet e sincronize pelo Histórico antes de sair."

  return `${summary} ${howToKeep}`
}

/*
 * Sair da conta apaga as ocorrências offline deste aparelho. Quando ainda
 * há alguma não enviada, pede confirmação antes. Use em todo botão de sair
 * e renderize o confirmDialog na página.
 */
export function useLogoutWithOfflineCheck() {
  const router = useRouter()

  const { logout, agreementRequired } = useCitizenSession()

  const [pendingCount, setPendingCount] = useState(0)

  const [confirmOpen, setConfirmOpen] = useState(false)

  const [loggingOut, setLoggingOut] = useState(false)

  async function confirmLogout() {
    setLoggingOut(true)

    try {
      await logout()

      router.replace("/")
    } finally {
      setLoggingOut(false)

      setConfirmOpen(false)
    }
  }

  async function requestLogout() {
    if (loggingOut) {
      return
    }

    const pending = await listOfflineOccurrences().catch(() => [])

    if (pending.length > 0) {
      setPendingCount(pending.length)

      setConfirmOpen(true)

      return
    }

    await confirmLogout()
  }

  const confirmDialog = (
    <MobileConfirmDialog
      open={confirmOpen}
      title="Sair e apagar ocorrências não enviadas?"
      description={pendingDescription(pendingCount, agreementRequired)}
      confirmLabel="Sair e apagar"
      danger
      submitting={loggingOut}
      onClose={() => setConfirmOpen(false)}
      onConfirm={() => void confirmLogout()}
    />
  )

  return {
    requestLogout,

    loggingOut,

    confirmDialog
  }
}
