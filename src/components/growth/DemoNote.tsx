export function DemoNote({ children }: { children?: React.ReactNode }) {
  return (
    <p className="text-xs text-muted" data-testid="demo-note">
      {children ?? "Demo accounts are stored in your browser. There is no server database, so clearing site data removes them."}
    </p>
  );
}
