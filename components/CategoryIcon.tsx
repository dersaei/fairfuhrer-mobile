import React from "react";
import Svg, { Circle, G, Path } from "react-native-svg";

export const CATEGORY_COLORS: Record<number, string> = {
  1: "#E45858", // Sehenswertes
  2: "#6477E3", // Essen & Übernachten
  3: "#F0873D", // Einkaufen
  5: "#42D742", // Engagement
  8: "#E0D12E", // Unternehmen
};

const CATEGORY_ICON_PATHS: Record<number, string[]> = {
  1: [
    "M10 10h4",
    "M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3",
    "M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z",
    "M22 16L2 16",
    "M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z",
    "M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3",
  ],
  2: [
    "M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2",
    "M7 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7",
  ],
  3: ["M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"],
  5: [
    "M19.414 14.414C21 12.828 22 11.5 22 9.5a5.5 5.5 0 0 0-9.591-3.676.6.6 0 0 1-.818.001A5.5 5.5 0 0 0 2 9.5c0 2.3 1.5 4 3 5.5l5.535 5.362a2 2 0 0 0 2.879.052 2.12 2.12 0 0 0-.004-3 2.124 2.124 0 1 0 3-3 2.124 2.124 0 0 0 3.004 0 2 2 0 0 0 0-2.828l-1.881-1.882a2.41 2.41 0 0 0-3.409 0l-1.71 1.71a2 2 0 0 1-2.828 0 2 2 0 0 1 0-2.828l2.823-2.762",
  ],
  8: [
    "M10 12h4",
    "M10 8h4",
    "M14 21v-3a2 2 0 0 0-4 0v3",
    "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
    "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
  ],
};

const DEFAULT_ICON_PATHS = [
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
  "M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
];

const ALL_ICON_PATHS = [
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
  "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20",
  "M2 12h20",
];

const SHOPPING_CART_CIRCLES = [
  { cx: "8", cy: "21", r: "1" },
  { cx: "19", cy: "21", r: "1" },
];

export function CategoryIcon({
  categoryId,
  color,
  strokeColor = "white",
  size = 36,
}: {
  categoryId: number | null;
  color: string;
  strokeColor?: string;
  size?: number;
}) {
  const paths =
    categoryId !== null ? (CATEGORY_ICON_PATHS[categoryId] ?? DEFAULT_ICON_PATHS) : ALL_ICON_PATHS;
  const extraCircles = categoryId === 3 ? SHOPPING_CART_CIRCLES : [];

  const scale = 0.6;
  const offset = 12 * (1 - scale);

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill={color} />
      <G
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform={`translate(${offset}, ${offset}) scale(${scale})`}
      >
        {paths.map((d, i) => (
          <Path key={i} d={d} />
        ))}
        {extraCircles.map((c, i) => (
          <Circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} fill="white" stroke="white" />
        ))}
      </G>
    </Svg>
  );
}
