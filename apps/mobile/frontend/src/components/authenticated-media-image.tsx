"use client"

import Image from "next/image"

import { useEffect, useState } from "react"

import { ImageIcon } from "lucide-react"

import { api } from "@/lib/api"

interface AuthenticatedMediaImageProps {
  src: string

  alt: string

  className?: string
}

export function AuthenticatedMediaImage({
  src,
  alt,
  className = ""
}: AuthenticatedMediaImageProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    let createdUrl: string | null = null

    setObjectUrl(null)

    setFailed(false)

    void api
      .getMediaContent(src)
      .then((blob) => {
        if (cancelled) {
          return
        }

        createdUrl = URL.createObjectURL(blob)

        setObjectUrl(createdUrl)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
        }
      })

    return () => {
      cancelled = true

      if (createdUrl) {
        URL.revokeObjectURL(createdUrl)
      }
    }
  }, [src])

  if (failed) {
    return (
      <div
        className={`flex min-h-40 items-center justify-center rounded-xl bg-slate-100 p-4 text-center text-xs text-slate-500 ${className}`}
      >
        <div>
          <ImageIcon className="mx-auto mb-2 h-6 w-6" />
          Não foi possível carregar esta imagem.
        </div>
      </div>
    )
  }

  if (!objectUrl) {
    return (
      <div
        className={`flex min-h-40 animate-pulse items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400 ${className}`}
      >
        Carregando imagem...
      </div>
    )
  }

  return (
    <div
      className={`relative min-h-52 overflow-hidden rounded-xl bg-slate-100 ${className}`}
    >
      <Image
        src={objectUrl}
        alt={alt}
        fill
        sizes="(max-width: 480px) 100vw, 448px"
        className="object-contain"
        unoptimized
      />
    </div>
  )
}
