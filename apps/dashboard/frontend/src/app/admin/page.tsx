"use client"

import { type FormEvent, useEffect, useMemo, useState } from "react"

import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Copy,
  Database,
  Pencil,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserPlus,
  UsersRound,
  X
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard-shell"

import {
  api,
  type ApiAdministrativeUser,
  type ApiAdminCategory,
  type ApiAuditLog,
  type ApiConfidenceThreshold,
  type ApiManagerInviteCreation,
  type ApiModelType
} from "@/lib/api"

type AdminSection = "managers" | "categories" | "thresholds" | "audit"

function statusLabel(status: ApiAdministrativeUser["status"]) {
  switch (status) {
    case "ACTIVE":
      return "Ativo"

    case "INACTIVE":
      return "Inativo"

    case "INVITED":
      return "Convite pendente"
  }
}

function roleLabel(role: ApiAdministrativeUser["role"]) {
  switch (role) {
    case "ADMIN":
      return "Administrador"

    case "MANAGER":
      return "Gestor"

    case "CITIZEN":
      return "Cidadão"

    case "RESEARCHER":
      return "Pesquisador"
  }
}

function modelTypeLabel(modelType: ApiModelType) {
  switch (modelType) {
    case "VISUAL":
      return "Visual"

    case "TEXTUAL":
      return "Textual"

    case "MULTIMODAL":
      return "Multimodal"

    case "RISK_PREDICTION":
      return "Previsão de risco"
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value))
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "—"
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AdminPage() {
  const [sessionLoading, setSessionLoading] = useState(true)

  const [isAdmin, setIsAdmin] = useState(false)

  const [section, setSection] = useState<AdminSection>("managers")

  const [managers, setManagers] = useState<ApiAdministrativeUser[]>([])

  const [categories, setCategories] = useState<ApiAdminCategory[]>([])

  const [thresholds, setThresholds] = useState<ApiConfidenceThreshold[]>([])

  const [auditLogs, setAuditLogs] = useState<ApiAuditLog[]>([])

  const [message, setMessage] = useState<string | null>(null)

  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  /*
   * Convite de gestor
   */

  const [name, setName] = useState("")

  const [email, setEmail] = useState("")

  const [inviteResult, setInviteResult] =
    useState<ApiManagerInviteCreation | null>(null)

  const [submittingInvite, setSubmittingInvite] = useState(false)

  const [changingManagerId, setChangingManagerId] = useState<string | null>(
    null
  )

  /*
   * Categorias
   */

  const [categorySearch, setCategorySearch] = useState("")

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  )

  const [editingCategoryName, setEditingCategoryName] = useState("")

  const [editingCategoryGroup, setEditingCategoryGroup] = useState("")

  const [changingCategoryId, setChangingCategoryId] = useState<string | null>(
    null
  )

  /*
   * Limiares
   */

  const [thresholdCategoryId, setThresholdCategoryId] = useState("")

  const [thresholdModelType, setThresholdModelType] =
    useState<ApiModelType>("TEXTUAL")

  const [lowUpperBound, setLowUpperBound] = useState("0.40")

  const [mediumUpperBound, setMediumUpperBound] = useState("0.70")

  const [submittingThreshold, setSubmittingThreshold] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const me = await api.me()

        if (cancelled) {
          return
        }

        if (me.data.role !== "ADMIN") {
          setIsAdmin(false)

          return
        }

        setIsAdmin(true)

        const [
          managersResponse,
          categoriesResponse,
          thresholdsResponse,
          auditResponse
        ] = await Promise.all([
          api.listAdminManagers(),
          api.listAdminCategories(),
          api.listConfidenceThresholds(),
          api.listAdminAudit()
        ])

        if (cancelled) {
          return
        }

        setManagers(managersResponse.data)

        setCategories(categoriesResponse.data)

        setThresholds(thresholdsResponse.data)

        setAuditLogs(auditResponse.data)

        const firstActiveCategory = categoriesResponse.data.find(
          (category) => category.active
        )

        if (firstActiveCategory) {
          setThresholdCategoryId(firstActiveCategory.id)
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar a administração."
          )
        }
      } finally {
        if (!cancelled) {
          setSessionLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  const activeCategories = useMemo(
    () => categories.filter((category) => category.active),
    [categories]
  )

  const filteredCategories = useMemo(() => {
    const search = categorySearch.trim().toLowerCase()

    if (!search) {
      return categories
    }

    return categories.filter(
      (category) =>
        category.cobradeCode.toLowerCase().includes(search) ||
        category.name.toLowerCase().includes(search) ||
        (category.groupName ?? "").toLowerCase().includes(search)
    )
  }, [categories, categorySearch])

  async function refreshManagers() {
    const response = await api.listAdminManagers()

    setManagers(response.data)
  }

  async function refreshCategories() {
    const response = await api.listAdminCategories()

    setCategories(response.data)
  }

  async function refreshThresholds() {
    const response = await api.listConfidenceThresholds()

    setThresholds(response.data)
  }

  async function refreshAudit() {
    const response = await api.listAdminAudit()

    setAuditLogs(response.data)
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)
    setSuccessMessage(null)
    setInviteResult(null)

    setSubmittingInvite(true)

    try {
      const response = await api.createManagerInvite({
        name,
        email
      })

      setInviteResult(response.data)

      setName("")
      setEmail("")

      setSuccessMessage(
        "Convite criado. Copie o link antes de sair desta tela."
      )

      await Promise.all([refreshManagers(), refreshAudit()])
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o convite."
      )
    } finally {
      setSubmittingInvite(false)
    }
  }

  async function handleManagerStatus(manager: ApiAdministrativeUser) {
    if (manager.role !== "MANAGER" || manager.status === "INVITED") {
      return
    }

    const nextStatus = manager.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"

    setMessage(null)
    setSuccessMessage(null)

    setChangingManagerId(manager.id)

    try {
      await api.updateManagerStatus(manager.id, nextStatus)

      await Promise.all([refreshManagers(), refreshAudit()])

      setSuccessMessage(
        nextStatus === "ACTIVE" ? "Gestor reativado." : "Gestor desativado."
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o gestor."
      )
    } finally {
      setChangingManagerId(null)
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value)

      setSuccessMessage("Copiado para a área de transferência.")
    } catch {
      setMessage("Não foi possível copiar automaticamente.")
    }
  }

  function startCategoryEdit(category: ApiAdminCategory) {
    setEditingCategoryId(category.id)

    setEditingCategoryName(category.name)

    setEditingCategoryGroup(category.groupName ?? "")
  }

  function cancelCategoryEdit() {
    setEditingCategoryId(null)
    setEditingCategoryName("")
    setEditingCategoryGroup("")
  }

  async function saveCategory(category: ApiAdminCategory) {
    setMessage(null)
    setSuccessMessage(null)

    setChangingCategoryId(category.id)

    try {
      await api.updateAdminCategory(category.id, {
        name: editingCategoryName,

        groupName: editingCategoryGroup.trim() ? editingCategoryGroup : null
      })

      cancelCategoryEdit()

      await Promise.all([refreshCategories(), refreshAudit()])

      setSuccessMessage("Categoria atualizada.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a categoria."
      )
    } finally {
      setChangingCategoryId(null)
    }
  }

  async function toggleCategory(category: ApiAdminCategory) {
    setMessage(null)
    setSuccessMessage(null)

    setChangingCategoryId(category.id)

    try {
      await api.updateAdminCategory(category.id, {
        active: !category.active
      })

      await Promise.all([refreshCategories(), refreshAudit()])

      setSuccessMessage(
        category.active ? "Categoria desativada." : "Categoria ativada."
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status da categoria."
      )
    } finally {
      setChangingCategoryId(null)
    }
  }

  async function handleThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage(null)
    setSuccessMessage(null)

    const low = Number(lowUpperBound)

    const medium = Number(mediumUpperBound)

    if (!Number.isFinite(low) || !Number.isFinite(medium)) {
      setMessage("Informe limites numéricos válidos.")

      return
    }

    if (low >= medium) {
      setMessage("O limite baixo deve ser menor que o limite médio.")

      return
    }

    if (!thresholdCategoryId) {
      setMessage("Selecione uma categoria.")

      return
    }

    setSubmittingThreshold(true)

    try {
      await api.createConfidenceThreshold({
        categoryId: thresholdCategoryId,

        modelType: thresholdModelType,

        lowUpperBound: low,

        mediumUpperBound: medium
      })

      await Promise.all([refreshThresholds(), refreshAudit()])

      setSuccessMessage("Nova versão de limiar criada.")
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o limiar."
      )
    } finally {
      setSubmittingThreshold(false)
    }
  }

  const activationUrl =
    inviteResult && typeof window !== "undefined"
      ? `${window.location.origin}/accept-invite?token=${encodeURIComponent(
          inviteResult.inviteToken
        )}`
      : null

  const sections: Array<{
    id: AdminSection
    label: string
    detail: string
  }> = [
    {
      id: "managers",
      label: "Gestores",
      detail: `${managers.length} conta(s)`
    },

    {
      id: "categories",
      label: "Categorias",
      detail: `${activeCategories.length}/${categories.length} ativas`
    },

    {
      id: "thresholds",
      label: "Limiares",
      detail: `${thresholds.length} versão(ões)`
    },

    {
      id: "audit",
      label: "Auditoria",
      detail: `${auditLogs.length} registro(s)`
    }
  ]

  return (
    <DashboardShell>
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-semibold text-slate-900">Administração</h1>

        <p className="text-sm text-slate-500">
          Usuários, catálogo COBRADE, limiares de confiança e auditoria
          persistidos no PostgreSQL.
        </p>
      </header>

      {sessionLoading ? (
        <main className="p-6">
          <p className="text-sm text-slate-600">Carregando administração...</p>
        </main>
      ) : !isAdmin ? (
        <main className="p-6">
          <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-5">
            <ShieldCheck className="mb-3 h-6 w-6 text-red-700" />

            <h2 className="font-semibold text-red-900">Acesso restrito</h2>

            <p className="mt-2 text-sm text-red-700">
              Esta área é exclusiva para usuários com papel ADMIN.
            </p>
          </div>
        </main>
      ) : (
        <main className="space-y-6 p-6">
          {message && (
            <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {message}
            </p>
          )}

          {successMessage && (
            <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />

              {successMessage}
            </p>
          )}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={[
                  "rounded-lg border p-4 text-left transition",

                  section === item.id
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                ].join(" ")}
              >
                <p className="font-semibold text-slate-900">{item.label}</p>

                <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
              </button>
            ))}
          </section>

          {section === "managers" && (
            <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-3 border-b border-slate-200 p-5">
                  <UsersRound className="h-6 w-6 text-emerald-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Usuários administrativos
                    </h2>

                    <p className="text-sm text-slate-500">
                      Contas reais do PostgreSQL.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {managers.map((manager) => (
                    <div
                      key={manager.id}
                      className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {manager.name ?? "Sem nome"}
                          </p>

                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                            {roleLabel(manager.role)}
                          </span>

                          <span
                            className={[
                              "rounded-full px-2 py-1 text-xs font-medium",

                              manager.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-700"
                                : manager.status === "INVITED"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600"
                            ].join(" ")}
                          >
                            {statusLabel(manager.status)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {manager.email}
                        </p>
                      </div>

                      {manager.role === "MANAGER" &&
                        manager.status !== "INVITED" && (
                          <button
                            type="button"
                            disabled={changingManagerId === manager.id}
                            onClick={() => void handleManagerStatus(manager)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {changingManagerId === manager.id
                              ? "Salvando..."
                              : manager.status === "ACTIVE"
                                ? "Desativar"
                                : "Reativar"}
                          </button>
                        )}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-5 flex items-center gap-3">
                  <UserPlus className="h-6 w-6 text-emerald-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Convidar gestor
                    </h2>

                    <p className="text-sm text-slate-500">
                      O convite expira em 24 horas.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(event) => void handleInvite(event)}
                  className="space-y-4"
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Nome
                    </span>

                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      E-mail
                    </span>

                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submittingInvite ? "Criando..." : "Criar convite"}
                  </button>
                </form>

                {inviteResult && activationUrl && (
                  <div className="mt-5 space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-semibold text-amber-900">
                      Convite criado
                    </p>

                    <p className="text-xs text-amber-800">
                      Copie o link agora. O token puro não é armazenado.
                    </p>

                    <div className="break-all rounded bg-white p-3 text-xs text-slate-700">
                      {activationUrl}
                    </div>

                    <button
                      type="button"
                      onClick={() => void copyText(activationUrl)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar link
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}

          {section === "categories" && (
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-blue-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Catálogo COBRADE
                    </h2>

                    <p className="text-sm text-slate-500">
                      {activeCategories.length} ativa(s) de {categories.length}{" "}
                      cadastrada(s).
                    </p>
                  </div>
                </div>

                <input
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Buscar código, nome ou grupo"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm lg:w-80"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">COBRADE</th>

                      <th className="px-4 py-3">Categoria</th>

                      <th className="px-4 py-3">Grupo</th>

                      <th className="px-4 py-3">Estado</th>

                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {filteredCategories.map((category) => {
                      const editing = editingCategoryId === category.id

                      return (
                        <tr key={category.id}>
                          <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-700">
                            {category.cobradeCode}
                          </td>

                          <td className="px-4 py-3">
                            {editing ? (
                              <input
                                value={editingCategoryName}
                                onChange={(event) =>
                                  setEditingCategoryName(event.target.value)
                                }
                                className="w-full rounded border border-slate-300 px-2 py-1"
                              />
                            ) : (
                              category.name
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {editing ? (
                              <input
                                value={editingCategoryGroup}
                                onChange={(event) =>
                                  setEditingCategoryGroup(event.target.value)
                                }
                                className="w-full rounded border border-slate-300 px-2 py-1"
                              />
                            ) : (
                              (category.groupName ?? "—")
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={[
                                "rounded-full px-2 py-1 text-xs font-medium",

                                category.active
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              ].join(" ")}
                            >
                              {category.active ? "Ativa" : "Inativa"}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      changingCategoryId === category.id
                                    }
                                    onClick={() => void saveCategory(category)}
                                    className="rounded border border-emerald-300 p-2 text-emerald-700"
                                    title="Salvar"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelCategoryEdit}
                                    className="rounded border border-slate-300 p-2 text-slate-600"
                                    title="Cancelar"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startCategoryEdit(category)}
                                  className="rounded border border-slate-300 p-2 text-slate-600"
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={changingCategoryId === category.id}
                                onClick={() => void toggleCategory(category)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                              >
                                {category.active ? "Desativar" : "Ativar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {section === "thresholds" && (
            <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="mb-5 flex items-center gap-3">
                  <SlidersHorizontal className="h-6 w-6 text-blue-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Nova versão
                    </h2>

                    <p className="text-sm text-slate-500">
                      A versão anterior do mesmo modelo e categoria será
                      desativada.
                    </p>
                  </div>
                </div>

                <form
                  onSubmit={(event) => void handleThreshold(event)}
                  className="space-y-4"
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Categoria
                    </span>

                    <select
                      required
                      value={thresholdCategoryId}
                      onChange={(event) =>
                        setThresholdCategoryId(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.cobradeCode} - {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Modelo
                    </span>

                    <select
                      value={thresholdModelType}
                      onChange={(event) =>
                        setThresholdModelType(
                          event.target.value as ApiModelType
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="VISUAL">Visual</option>

                      <option value="TEXTUAL">Textual</option>

                      <option value="MULTIMODAL">Multimodal</option>

                      <option value="RISK_PREDICTION">Previsão de risco</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Limite superior de baixa confiança
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={lowUpperBound}
                      onChange={(event) => setLowUpperBound(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-700">
                      Limite superior de média confiança
                    </span>

                    <input
                      required
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={mediumUpperBound}
                      onChange={(event) =>
                        setMediumUpperBound(event.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={submittingThreshold || !thresholdCategoryId}
                    className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {submittingThreshold ? "Salvando..." : "Criar nova versão"}
                  </button>
                </form>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center gap-3 border-b border-slate-200 p-5">
                  <Activity className="h-6 w-6 text-emerald-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">
                      Histórico de limiares
                    </h2>

                    <p className="text-sm text-slate-500">
                      Versionamento persistido no banco.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Categoria</th>

                        <th className="px-4 py-3">Modelo</th>

                        <th className="px-4 py-3">Baixa</th>

                        <th className="px-4 py-3">Média</th>

                        <th className="px-4 py-3">Versão</th>

                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {thresholds.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-slate-500"
                          >
                            Nenhum limiar cadastrado.
                          </td>
                        </tr>
                      ) : (
                        thresholds.map((threshold) => (
                          <tr key={threshold.id}>
                            <td className="px-4 py-3">
                              {threshold.category
                                ? `${threshold.category.cobradeCode} - ${threshold.category.name}`
                                : "Sem categoria"}
                            </td>

                            <td className="px-4 py-3">
                              {modelTypeLabel(threshold.modelType)}
                            </td>

                            <td className="px-4 py-3">
                              {Math.round(threshold.lowUpperBound * 100)}%
                            </td>

                            <td className="px-4 py-3">
                              {Math.round(threshold.mediumUpperBound * 100)}%
                            </td>

                            <td className="px-4 py-3">v{threshold.version}</td>

                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "rounded-full px-2 py-1 text-xs font-medium",

                                  threshold.active
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                ].join(" ")}
                              >
                                {threshold.active ? "Ativo" : "Histórico"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {section === "audit" && (
            <section className="rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-6 w-6 text-slate-700" />

                  <div>
                    <h2 className="font-semibold text-slate-900">Auditoria</h2>

                    <p className="text-sm text-slate-500">
                      Até 100 registros mais recentes.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void refreshAudit()}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Atualizar
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>

                      <th className="px-4 py-3">Ação</th>

                      <th className="px-4 py-3">Ator</th>

                      <th className="px-4 py-3">Entidade</th>

                      <th className="px-4 py-3">Dados</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="align-top">
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          {formatDate(log.createdAt)}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {log.action}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {log.actorUser
                            ? `${log.actorUser.name ?? "Sem nome"} (${log.actorUser.role})`
                            : "Sistema"}
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-xs font-semibold text-slate-700">
                            {log.entityType}
                          </p>

                          <p className="mt-1 max-w-48 break-all font-mono text-xs text-slate-500">
                            {log.entityId}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-emerald-700">
                              Ver detalhes
                            </summary>

                            <div className="mt-2 space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-slate-600">
                                  Antes
                                </p>

                                <pre className="mt-1 max-w-96 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                                  {formatJson(log.beforeData)}
                                </pre>
                              </div>

                              <div>
                                <p className="text-xs font-semibold text-slate-600">
                                  Depois
                                </p>

                                <pre className="mt-1 max-w-96 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                                  {formatJson(log.afterData)}
                                </pre>
                              </div>

                              <div>
                                <p className="text-xs font-semibold text-slate-600">
                                  Metadados
                                </p>

                                <pre className="mt-1 max-w-96 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                                  {formatJson(log.metadata)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      )}
    </DashboardShell>
  )
}
