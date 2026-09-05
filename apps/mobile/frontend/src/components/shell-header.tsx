import Image from "next/image"

export function ShellHeader({
  title,
  subtitle
}: {
  title: string
  subtitle: string
}) {
  return (
    <header className="border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Image
          src="/kamara-logo.png"
          alt="Kamara"
          width={40}
          height={40}
          className="rounded"
          priority
        />

        <div>
          <p className="font-semibold text-emerald-800">{title}</p>

          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
