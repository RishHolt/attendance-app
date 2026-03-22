import Image from "next/image"

type BrandLogoProps = {
  className?: string
  size?: number
}

export const BrandLogo = ({ className = "", size = 36 }: BrandLogoProps) => {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src="/SDO-Logo.png"
        alt="Schools Division Office, Quezon City"
        width={size}
        height={size}
        className="object-contain"
        priority
      />
    </div>
  )
}
