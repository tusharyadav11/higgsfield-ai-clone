/** Re-mounts on every navigation, so each route fades/slides in (CSS only). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
