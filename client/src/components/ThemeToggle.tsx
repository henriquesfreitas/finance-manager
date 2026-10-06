import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/theme-context';

export function ThemeToggle({ onHeader = false }: { onHeader?: boolean }): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} theme`}
      title={`Switch to ${nextTheme} theme`}
      className={onHeader
        ? 'shrink-0 text-white hover:bg-white/15 hover:text-white'
        : 'shrink-0 border bg-card text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground'}
    >
      {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </Button>
  );
}
