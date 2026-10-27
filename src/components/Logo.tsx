export function Logo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`fomo-logo ${className}`}
      src="/fomo3d-logo.png"
      alt="Fomo3D"
      width={44}
      height={44}
    />
  );
}
