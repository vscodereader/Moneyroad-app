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
