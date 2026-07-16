type BrandLockupProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLockup({ className = "", compact = false }: BrandLockupProps) {
  return (
    <span className={`brand-lockup${compact ? " is-compact" : ""}${className ? ` ${className}` : ""}`}>
      <img src="/brand/fizyoflow-current-mark.png" alt="" aria-hidden="true" />
      <strong>FizyoFlow</strong>
    </span>
  );
}
