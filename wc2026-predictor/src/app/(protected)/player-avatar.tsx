import { flagEmoji } from "@/lib/data/teams";

/**
 * Small round player photo from the squad data. Falls back to the team flag when
 * there is no photo (the ~52 award-contender rows have none). Uses a plain <img>
 * because the photos are external (media.api-sports.io) and not worth wiring into
 * next/image remote patterns for tiny avatars.
 */
export function PlayerAvatar({
  photo,
  isoCode,
  alt = "",
  size = 20,
}: {
  photo: string | null | undefined;
  isoCode?: string | null;
  alt?: string;
  size?: number;
}) {
  const box = { width: size, height: size };
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={alt}
        loading="lazy"
        style={box}
        className="inline-block shrink-0 rounded-full bg-black/10 object-cover align-middle dark:bg-white/10"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...box, fontSize: Math.round(size * 0.62) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-black/10 align-middle dark:bg-white/10"
    >
      {isoCode ? flagEmoji(isoCode) : ""}
    </span>
  );
}
