import type { ModuleKey } from "@/lib/access";

export type AppIconName =
  | ModuleKey
  | "shield"
  | "logout"
  | "close"
  | "menu"
  | "chevron-right";

type AppIconProps = {
  name: AppIconName;
  className?: string;
};

export function AppIcon({ className, name }: AppIconProps) {
  const paths = getPaths(name);

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      {paths.map((path, index) => (
        <path d={path} key={`${name}-${index}`} />
      ))}
    </svg>
  );
}

function getPaths(name: AppIconName) {
  switch (name) {
    case "inicio":
      return ["M3 11.5 12 4l9 7.5", "M5.5 10.5V20h13v-9.5", "M9.5 20v-5h5v5"];
    case "defecto-puntual":
      return ["M12 5v14", "M5 12h14", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"];
    case "revision-pauta":
      return ["M8 4h8l1 2h3v15H4V6h3l1-2Z", "m8 13 2 2 5-5", "M8 18h8"];
    case "historial":
      return ["M7 3h10v18H7V3Z", "M10 8h4", "M10 12h4", "M10 16h2"];
    case "notificaciones":
      return ["M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7Z", "M10 20a2 2 0 0 0 4 0"];
    case "reportes":
      return ["M4 19h16", "M7 16V9", "M12 16V5", "M17 16v-4"];
    case "resolver-defectos":
      return ["M9 11 11 13 22 2", "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"];
    case "administracion":
      return ["M16 21v-2a4 4 0 0 0-8 0v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M19 8v4", "M21 10h-4"];
    case "datos-maestros":
      return [
        "M4 6c0-1.1 3.6-2 8-2s8 .9 8 2-3.6 2-8 2-8-.9-8-2Z",
        "M4 6v6c0 1.1 3.6 2 8 2s8-.9 8-2V6",
        "M4 12v6c0 1.1 3.6 2 8 2s8-.9 8-2v-6",
      ];
    case "shield":
      return ["M12 3 5.5 5.6v5.3c0 4.1 2.7 7.8 6.5 9.1 3.8-1.3 6.5-5 6.5-9.1V5.6L12 3Z", "m9 12 2 2 4-5"];
    case "logout":
      return ["M14 8V5a2 2 0 0 0-2-2H5v18h7a2 2 0 0 0 2-2v-3", "M9 12h11", "m17 9 3 3-3 3"];
    case "close":
      return ["M18 6 6 18", "m6 6 12 12"];
    case "menu":
      return ["M4 7h16", "M4 12h16", "M4 17h16"];
    case "chevron-right":
      return ["m9 18 6-6-6-6"];
    default:
      return ["M5 12h14"];
  }
}
