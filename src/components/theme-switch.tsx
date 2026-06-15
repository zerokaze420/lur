import { FC, useCallback } from "react";
import { Button, useTheme } from "@heroui/react";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

export interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { resolvedTheme, setTheme } = useTheme("light");

  const isLight = resolvedTheme === "light";

  const toggleTheme = useCallback(() => {
    setTheme(isLight ? "dark" : "light");
  }, [isLight, setTheme]);

  if (!resolvedTheme) {
    return <div aria-hidden className="h-8 w-8" />;
  }

  return (
    <Button
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      className={className}
      isIconOnly
      size="sm"
      type="button"
      variant="ghost"
      onClick={toggleTheme}
    >
      {isLight ? <MoonFilledIcon size={22} /> : <SunFilledIcon size={22} />}
    </Button>
  );
};
