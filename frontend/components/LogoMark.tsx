/** Arvexo star: six bars at 60 degrees. Uses currentColor so it follows the theme. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" focusable="false">
      {[0, 60, 120, 180, 240, 300].map((angle) => (
        <rect key={angle} x="45" y="0" width="10" height="34.4" rx="1" transform={`rotate(${angle} 50 50)`} />
      ))}
    </svg>
  );
}
