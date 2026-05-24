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
  logoGoogle: ({ size = DEFAULT_SIZE, color = DEFAULT_COLOR }: IconProps) => (
    <Base size={size}>
      <Path
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
        fill={color}
      />
    </Base>
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
        d="M22.125 0H1.875C.8394 0 0 .8394 0 1.875v20.25C0 23.1606.8394 24 1.875 24h20.25C23.1606 24 24 23.1606 24 22.125V1.875C24 .8394 23.1606 0 22.125 0zM12 18.75c-.591 0-1.1697-.0413-1.7317-.1209-.5626.3965-3.813 2.6797-4.1198 2.7225 0 0-.1258.0489-.2328-.0141s-.0876-.2282-.0876-.2282c.0322-.2198.8426-3.0183.992-3.5333-2.7452-1.36-4.5701-3.7686-4.5701-6.5135C2.25 6.8168 6.6152 3.375 12 3.375s9.75 3.4418 9.75 7.6875c0 4.2457-4.3652 7.6875-9.75 7.6875zM8.0496 9.8672h-.8777v3.3417c0 .2963-.2523.5372-.5625.5372s-.5625-.2409-.5625-.5372V9.8672h-.8777c-.3044 0-.552-.2471-.552-.5508s.2477-.5508.552-.5508h2.8804c.3044 0 .552.2471.552.5508s-.2477.5508-.552.5508zm10.9879 2.9566a.558.558 0 0 1 .108.4167.5588.5588 0 0 1-.2183.371.5572.5572 0 0 1-.3383.1135.558.558 0 0 1-.4493-.2236l-1.3192-1.7479-.1952.1952v1.2273a.5635.5635 0 0 1-.5627.5628.563.563 0 0 1-.5625-.5625V9.3281c0-.3102.2523-.5625.5625-.5625s.5625.2523.5625.5625v1.209l1.5694-1.5694c.0807-.0807.1916-.1252.312-.1252.1404 0 .2814.0606.3871.1661.0985.0984.1573.2251.1654.3566.0082.1327-.036.2542-.1241.3425l-1.2818 1.2817 1.3845 1.8344zm-8.3502-3.5023c-.095-.2699-.3829-.5475-.7503-.5557-.3663.0083-.6542.2858-.749.5551l-1.3455 3.5415c-.1708.5305-.0217.7272.1333.7988a.8568.8568 0 0 0 .3576.0776c.2346 0 .4139-.0952.4678-.2481l.2787-.7297 1.7152.0001.2785.7292c.0541.1532.2335.2484.4681.2484a.8601.8601 0 0 0 .3576-.0775c.1551-.0713.3041-.2681.1329-.7999l-1.3449-3.5398zm-1.3116 2.4433l.5618-1.5961.5618 1.5961H9.3757zm5.9056 1.3836c0 .2843-.2418.5156-.5391.5156h-1.8047c-.2973 0-.5391-.2314-.5391-.5156V9.3281c0-.3102.2576-.5625.5742-.5625s.5742.2523.5742.5625v3.3047h1.1953c.2974 0 .5392.2314.5392.5156z"
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
