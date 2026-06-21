"use client"
import type { LinkProps } from "next/link"
import Link from "next/link"
import { type ForesightRegisterOptions } from "js.foresight"
import { useRouter } from "next/navigation"
import { useRef, useEffect, useMemo } from "react"
import {
  ForesightManager,
  type ForesightRegisterOptionsWithoutElement,
  type ForesightRegisterResult,
} from "js.foresight"

interface ForesightLinkProps
  extends Omit<LinkProps, "prefetch">, Omit<ForesightRegisterOptions, "element" | "callback"> {
  children: React.ReactNode
  className?: string
}

function useForesight<T extends HTMLElement = HTMLElement>(
  options: ForesightRegisterOptionsWithoutElement
) {
  const elementRef = useRef<T>(null)
  const registerResults = useRef<ForesightRegisterResult | null>(null)
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    registerResults.current = ForesightManager.instance.register({ element: el, ...options });
  }, [options])

  return { elementRef, registerResults }
}

export function FSLink({ children, className, ...props }: ForesightLinkProps) {
  const router = useRouter()
  const foresightOptions = useMemo(
    () => ({
      callback: () => {
        router.prefetch(props.href.toString())
      },
      hitSlop: props.hitSlop,
      name: props.name,
      meta: props.meta,
      reactivateAfter: props.reactivateAfter,
    }),
    [props.href, props.hitSlop, props.name, props.meta, props.reactivateAfter, router],
  )
  const { elementRef } = useForesight<HTMLAnchorElement>(foresightOptions)

  return (
    <Link {...props} ref={elementRef} className={className} prefetch={false}>
      {children}
    </Link>
  )
}