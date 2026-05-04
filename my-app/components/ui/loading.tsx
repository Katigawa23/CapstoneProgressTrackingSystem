import * as React from "react"

import { cn } from "@/lib/utils"

type LoadingProps = React.ComponentProps<"div"> & {
  size?: number
  primaryColor?: string
  secondaryColor?: string
  thickness?: number
}

export function Loading({
  className,
  size = 50,
  primaryColor = "#3E6ADC",
  secondaryColor = "#E4E4ED",
  thickness = 6,
  style,
  ...props
}: LoadingProps) {
  return (
    <>
      <style>{`
        @keyframes loading-spin-forward {
          to { transform: rotate(1turn); }
        }

        @keyframes loading-spin-reverse {
          to { transform: rotate(-1turn); }
        }
      `}</style>
      <div
        className={cn("relative", className)}
        style={
          {
            ...style,
            width: size,
            height: size,
          } as React.CSSProperties
        }
        {...props}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full border-solid"
          style={{
            borderWidth: thickness,
            borderColor: "transparent",
            borderTopColor: primaryColor,
            borderLeftColor: primaryColor,
            animation: "loading-spin-forward 1.5s ease-in-out infinite",
          }}
        />
        <span
          aria-hidden="true"
          className="absolute rounded-full border-solid"
          style={{
            inset: thickness,
            borderWidth: thickness,
            borderColor: "transparent",
            borderBottomColor: secondaryColor,
            borderRightColor: secondaryColor,
            animation: "loading-spin-reverse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    </>
  )
}
