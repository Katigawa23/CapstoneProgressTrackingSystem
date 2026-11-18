import Image from "next/image"

type TrackSphereLogoProps = {
  className?: string
  priority?: boolean
}

export function TrackSphereLogo({
  className,
  priority = false,
}: TrackSphereLogoProps) {
  return (
    <Image
      src="/tracksphere-logo.svg"
      alt="TrackSphere"
      width={282}
      height={52}
      className={className}
      priority={priority}
    />
  )
}
