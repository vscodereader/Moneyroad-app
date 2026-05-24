// MoneyRoad — icon set (Lucide-style, ported to react-native-svg)

import Svg, { Circle, Line, Path, Polygon, Polyline } from "react-native-svg";

export interface IconProps {
  color?: string;
  filled?: boolean;
  size?: number;
}

const DEFAULT_SIZE = 24;
const DEFAULT_COLOR = "currentColor";

type BaseProps = IconProps & {
  children: React.ReactNode;
  strokeWidth?: number;
};

function Base({
  size = DEFAULT_SIZE,
  children,
}: Omit<BaseProps, "color" | "strokeWidth">) {
  return (
    <Svg fill="none" height={size} viewBox="0 0 24 24" width={size}>
      {children}
    </Svg>
  );
}

const stroke = (color = DEFAULT_COLOR, width = 2) => ({
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none" as const,
});

export const Icon = {
  star: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR, filled }: IconProps) => (
    <Base size={size}>
      <Polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        {...stroke(color, 1.8)}
        fill={filled ? color : "none"}
      />
    </Base>
  ),
  search: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Circle cx="11" cy="11" r="8" {...stroke(color)} />
      <Path d="m21 21-4.3-4.3" {...stroke(color)} />
    </Base>
  ),
  bell: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...stroke(color)} />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...stroke(color)} />
    </Base>
  ),
  chevDown: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="6 9 12 15 18 9" {...stroke(color)} />
    </Base>
  ),
  chevRight: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="9 18 15 12 9 6" {...stroke(color)} />
    </Base>
  ),
  chevLeft: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="15 18 9 12 15 6" {...stroke(color)} />
    </Base>
  ),
  arrowUp: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="18 15 12 9 6 15" {...stroke(color, 2.4)} />
    </Base>
  ),
  arrowDown: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="6 9 12 15 18 9" {...stroke(color, 2.4)} />
    </Base>
  ),
  close: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Line x1="18" x2="6" y1="6" y2="18" {...stroke(color)} />
      <Line x1="6" x2="18" y1="6" y2="18" {...stroke(color)} />
    </Base>
  ),
  plus: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Line x1="12" x2="12" y1="5" y2="19" {...stroke(color)} />
      <Line x1="5" x2="19" y1="12" y2="12" {...stroke(color)} />
    </Base>
  ),
  check: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="20 6 9 17 4 12" {...stroke(color, 3)} />
    </Base>
  ),
  share: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Circle cx="18" cy="5" r="3" {...stroke(color)} />
      <Circle cx="6" cy="12" r="3" {...stroke(color)} />
      <Circle cx="18" cy="19" r="3" {...stroke(color)} />
      <Line x1="8.59" x2="15.42" y1="13.51" y2="17.49" {...stroke(color)} />
      <Line x1="15.41" x2="8.59" y1="6.51" y2="10.49" {...stroke(color)} />
    </Base>
  ),
  thumbsUp: ({
    size = DEFAULT_SIZE,
    color = DEFAULT_COLOR,
    filled,
  }: IconProps) => (
    <Base size={size}>
      <Path d="M7 10v12" {...stroke(color)} fill={filled ? color : "none"} />
      <Path
        d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H7"
        {...stroke(color)}
        fill={filled ? color : "none"}
      />
      <Path d="M3 10h4" {...stroke(color)} />
    </Base>
  ),
  reply: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        {...stroke(color)}
      />
    </Base>
  ),
  trending: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="23 6 13.5 15.5 8.5 10.5 1 18" {...stroke(color)} />
      <Polyline points="17 6 23 6 23 12" {...stroke(color)} />
    </Base>
  ),
  sliders: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Line x1="4" x2="4" y1="21" y2="14" {...stroke(color)} />
      <Line x1="4" x2="4" y1="10" y2="3" {...stroke(color)} />
      <Line x1="12" x2="12" y1="21" y2="12" {...stroke(color)} />
      <Line x1="12" x2="12" y1="8" y2="3" {...stroke(color)} />
      <Line x1="20" x2="20" y1="21" y2="16" {...stroke(color)} />
      <Line x1="20" x2="20" y1="12" y2="3" {...stroke(color)} />
      <Line x1="1" x2="7" y1="14" y2="14" {...stroke(color)} />
      <Line x1="9" x2="15" y1="8" y2="8" {...stroke(color)} />
      <Line x1="17" x2="23" y1="16" y2="16" {...stroke(color)} />
    </Base>
  ),
  sparkles: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M12 2l1.7 5.4L19 9.2l-5.3 1.8L12 16.4l-1.7-5.4L5 9.2l5.3-1.8L12 2zm7 11l.9 2.6L22 16.7l-2.1.9L19 20l-.9-2.4-2.1-.9 2.1-1.1.9-2.6zm-13 4l.6 1.8L8.4 19l-1.8.6L6 21l-.6-1.4L3.6 19l1.8-.6L6 17z"
        fill={color}
      />
    </Base>
  ),
  // Brand marks (monochrome, filled with the given color). Source: simple-icons.
  // Official multicolor Google "G" (fixed colors; ignores the color prop).
  logoGoogle: ({ size = DEFAULT_SIZE }: IconProps) => (
    <Svg height={size} viewBox="0 0 256 262" width={size}>
      <Path
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
        fill="#4285f4"
      />
      <Path
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
        fill="#34a853"
      />
      <Path
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
        fill="#fbbc05"
      />
      <Path
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
        fill="#eb4335"
      />
    </Svg>
  ),
  logoApple: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
        fill={color}
      />
    </Base>
  ),
  logoNaver: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845Z"
        fill={color}
      />
    </Base>
  ),
  logoKakao: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M12 3c5.8 0 10.501 3.664 10.501 8.185c0 4.52-4.701 8.184-10.5 8.184a14 14 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866c0-4.52 4.7-8.185 10.5-8.185m5.908 8.06l1.47-1.424a.472.472 0 0 0-.656-.678l-1.928 1.866V9.282a.472.472 0 0 0-.944 0v2.557a.5.5 0 0 0 0 .222V13.5a.472.472 0 0 0 .944 0v-1.363l.427-.413l1.428 2.033a.472.472 0 1 0 .773-.543zm-2.958 1.924h-1.46V9.297a.472.472 0 0 0-.943 0v4.159c0 .26.21.472.471.472h1.932a.472.472 0 1 0 0-.944m-5.857-1.091l.696-1.708l.638 1.707zm2.523.487l.002-.016a.47.47 0 0 0-.127-.32l-1.046-2.8a.69.69 0 0 0-.627-.474a.7.7 0 0 0-.653.447l-1.662 4.075a.472.472 0 0 0 .874.357l.332-.813h2.07l.298.8a.472.472 0 1 0 .884-.33zM8.294 9.302a.47.47 0 0 0-.471-.472H4.578a.472.472 0 1 0 0 .944h1.16v3.736a.472.472 0 0 0 .944 0V9.774h1.14a.47.47 0 0 0 .472-.472"
        fill={color}
      />
    </Base>
  ),
  alert: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Circle cx="12" cy="12" r="10" {...stroke(color)} />
      <Line x1="12" x2="12" y1="8" y2="12" {...stroke(color)} />
      <Circle cx="12" cy="16" fill={color} r="0.8" />
    </Base>
  ),
  send: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Line x1="22" x2="11" y1="2" y2="13" {...stroke(color, 2.5)} />
      <Polygon points="22 2 15 22 11 13 2 9 22 2" {...stroke(color, 2.5)} />
    </Base>
  ),
  pin: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path d="M12 17v5l3-3-3-2zm0-3l4-4-4-9-4 9 4 4z" fill={color} />
    </Base>
  ),
  logo: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="3 17 9 11 13 15 21 7" {...stroke(color, 2.8)} />
      <Polyline points="14 7 21 7 21 14" {...stroke(color, 2.8)} />
    </Base>
  ),
  navHome: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        {...stroke(color)}
      />
      <Polyline points="9 22 9 12 15 12 15 22" {...stroke(color)} />
    </Base>
  ),
  navWatch: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polygon
        points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
        {...stroke(color)}
      />
    </Base>
  ),
  navSignal: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="3 17 9 11 13 15 21 7" {...stroke(color)} />
      <Polyline points="14 7 21 7 21 14" {...stroke(color)} />
    </Base>
  ),
  navNews: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"
        {...stroke(color)}
      />
      <Path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" {...stroke(color)} />
    </Base>
  ),
  navDiscuss: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        {...stroke(color)}
      />
    </Base>
  ),
  navUser: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" {...stroke(color)} />
      <Circle cx="12" cy="7" r="4" {...stroke(color)} />
    </Base>
  ),
  sigTech: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Polyline points="3 17 9 11 13 15 21 7" {...stroke(color)} />
    </Base>
  ),
  sigAi: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        {...stroke(color)}
      />
      <Circle cx="12" cy="12" r="4" {...stroke(color)} />
    </Base>
  ),
  sigEvent: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" {...stroke(color)} />
    </Base>
  ),
  sigComm: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...stroke(color)} />
      <Circle cx="9" cy="7" r="4" {...stroke(color)} />
      <Path
        d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        {...stroke(color)}
      />
    </Base>
  ),
};

export const SIGNAL_TYPE_ICON = {
  tech: Icon.sigTech,
  ai: Icon.sigAi,
  event: Icon.sigEvent,
  community: Icon.sigComm,
};

export const SIGNAL_ACTION_ICON = {
  buy: Icon.arrowUp,
  sell: Icon.arrowDown,
  hold: Icon.navWatch,
};
