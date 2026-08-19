import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "color-mix(in srgb, var(--card) 88%, transparent)",
          "--normal-text": "var(--foreground)",
          "--normal-border": "color-mix(in srgb, var(--border) 82%, transparent)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
