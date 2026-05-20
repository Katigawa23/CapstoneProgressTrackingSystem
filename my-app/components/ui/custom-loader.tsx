import * as React from "react"

import { cn } from "@/lib/utils"

type CustomLoaderProps = React.ComponentProps<"div"> & {
  size?: number
  color?: string
}

export function CustomLoader({
  className,
  color = "#0B5793",
  size = 80,
  style,
  ...props
}: CustomLoaderProps) {
  const blockSize = Math.round(size * 0.525)
  const expandedSize = Math.round(size * 1.5)

  return (
    <div
      className={cn("custom-loader", className)}
      style={
        {
          ...style,
          "--custom-loader-color": color,
          "--custom-loader-size": `${size}px`,
          "--custom-loader-block-size": `${blockSize}px`,
          "--custom-loader-expanded-size": `${expandedSize}px`,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
