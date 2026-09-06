"use client"

import Image from "next/image"
import { useEffect, useState } from "react"

import { ImageOff } from "lucide-react"

import { api } from "@/lib/api"

interface AuthenticatedMediaImageProps {
  src: string

  alt: string

  sizes: string

  className?: string
}

export function AuthenticatedMediaImage({
  src,
  alt,
  sizes,
  className
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

  if (!objectUrl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        {failed ? (
          <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
            <ImageOff className="h-8 w-8" />

            <span>Imagem indisponivel</span>
          </div>
        ) : (
          <span className="text-sm text-slate-500">Carregando imagem...</span>
        )}
      </div>
    )
  }

  return (
    <Image
      src={objectUrl}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      unoptimized
    />
  )
}
