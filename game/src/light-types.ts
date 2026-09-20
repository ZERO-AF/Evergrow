/** Shared light record; kept headless so loot beams and warning logic can build lights. */
export interface PointLight {
  x: number;
  y: number;
  radius: number;
  color: string;
  power: number;
  shadows?: boolean;
  /** Fixed environmental anchor; dynamic lights render through the reusable scratch. */
  stationary?: boolean;
  /** World-space visibility polygon, used by enclosed environments. */
  clip?: readonly { x: number; y: number }[];
}
