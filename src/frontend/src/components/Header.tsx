import { Film, Mic2 } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-subtle">
      <div className="container mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex-shrink-0">
          <Film className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
            Screenplay Table Read
          </h1>
          <p className="text-xs text-muted-foreground leading-none">
            Bring your script to life
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0">
          <Mic2 className="w-3.5 h-3.5 text-primary/60" />
          <span className="hidden sm:inline">Kokoro TTS</span>
        </div>
      </div>
    </header>
  );
}
