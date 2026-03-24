import React from "react";
import Svg, { Path, Circle, Line, Polyline } from "react-native-svg";

type IconProps = { color: string; size?: number };

export function HomeIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M4 11.5 12 4l8 7.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6.5 11.5V20H17.5V11.5"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SendIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Path
        d="M4 4l16 8-16 8 3-8z"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M11 12h4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ReceiveIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Polyline
        points="12 3 12 17"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="7 12 12 17 17 12"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={5}
        y1={20}
        x2={19}
        y2={20}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ActivityIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {/* Up arrow (sent) */}
      <Path
        d="M8 18V6"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M4 10l4-4 4 4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Down arrow (received) */}
      <Path
        d="M16 6v12"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 14l4 4 4-4"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PnLIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      {/* Baseline */}
      <Path
        d="M4 19H20"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Short bar */}
      <Path
        d="M8 19V15"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Medium bar */}
      <Path
        d="M12 19V11"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tall bar */}
      <Path
        d="M16 19V6"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size}>
      <Circle
        cx={12}
        cy={12}
        r={3}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
      {/* Gear teeth — top, right, bottom, left, and diagonals */}
      <Line x1={12} y1={1} x2={12} y2={4} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={20} x2={12} y2={23} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={1} y1={12} x2={4} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={20} y1={12} x2={23} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={4.22} y1={4.22} x2={6.34} y2={6.34} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={17.66} y1={17.66} x2={19.78} y2={19.78} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={4.22} y1={19.78} x2={6.34} y2={17.66} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={17.66} y1={6.34} x2={19.78} y2={4.22} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
