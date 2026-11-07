import Image from "next/image";
import type { RankTier } from "@/lib/game/constants";

const SRC = ["/badges/novice.png", "/badges/pilot.png", "/badges/ace.png"] as const;

export function RankMark({
  tier,
  size = 64,
  earned = false,
}: {
  tier: RankTier;
  size?: number;
  earned?: boolean;
}) {
  return (
    <Image
      src={SRC[tier]}
      alt=""
      width={size}
      height={size}
      unoptimized
      draggable={false}
      className={earned ? "" : "opacity-75"}
      style={{
        width: size,
        height: size,
        imageRendering: "pixelated",
      }}
    />
  );
}
