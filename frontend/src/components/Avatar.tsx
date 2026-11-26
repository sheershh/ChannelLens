import Image from "next/image";

export default function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  if (!src) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-red-500/20 font-semibold text-red-200"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    );
  }
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized
      className="shrink-0 rounded-full bg-white/5 object-cover"
      style={{ width: size, height: size }}
    />
  );
}
