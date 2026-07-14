export function SectionLabel({
  children,
  aside,
}: {
  children: string;
  aside?: string;
}) {
  return (
    <div className="flex items-center justify-between px-2 pb-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
        {children}
      </span>
      {aside && (
        <span className="text-[11px] font-medium text-subtle">{aside}</span>
      )}
    </div>
  );
}
