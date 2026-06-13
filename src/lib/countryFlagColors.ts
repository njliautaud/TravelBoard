/**
 * Accent color for each country's flag — dominant hue, or a well-known association
 * when bands are even (e.g. France → navy, Netherlands → orange).
 * Tuned for visibility on the dark Carto basemap.
 */
export const COUNTRY_FLAG_ACCENT: Record<string, string> = {
  "-99": "#94a3b8",
  AFG: "#d32011", // black/red/green — red field
  AGO: "#cc092f", // red/black — red half
  ALB: "#e41e20", // red eagle on red
  ARE: "#00732f", // green white black red — green hoist
  ARG: "#74acdf", // light blue white light blue
  ARM: "#d90012", // red blue orange — red dominant
  ATA: "#3b82f6", // blue/white — Antarctic
  ATF: "#002395", // French Southern — French blue
  AUS: "#00008b", // blue ensign
  AUT: "#ed2939", // red white red
  AZE: "#00afca", // blue star on tricolor — sky blue
  BDI: "#ce1126", // red white green — red top
  BEL: "#fdda24", // black/yellow/red — gold band
  BEN: "#fcd116", // green/yellow/red — yellow band
  BFA: "#009e49", // red/green — green field
  BGD: "#006a4e", // green on red circle — green
  BGR: "#00966e", // white/green/red — green band
  BHS: "#00778b", // aquamarine/black/gold — aquamarine
  BIH: "#002395", // blue/yellow — blue triangle
  BLR: "#d22730", // red/green — red ornamental strip
  BLZ: "#003f87", // blue with red stripes
  BMU: "#cf142b", // British red ensign
  BOL: "#d52b1e", // red/yellow/green — red band
  BRA: "#009739", // green field
  BRN: "#fcd116", // yellow on black/white
  BTN: "#ff4e12", // orange dragon
  BWA: "#75aadb", // light blue
  CAF: "#003082", // blue/yellow/green/red/white — blue stripe
  CAN: "#ff0000", // red maple leaf
  CHE: "#ff0000", // red square
  CHL: "#0039a6", // blue/white/red — blue canton
  CHN: "#de2910", // red field
  CIV: "#f77f00", // orange/white/green — orange hoist
  CMR: "#007a5e", // green/red/yellow — green stripe
  COD: "#007fff", // sky blue field
  COG: "#009543", // green diagonal
  COL: "#fcd116", // yellow wider band
  CRI: "#002b7f", // blue/white/red — blue
  "CS-KM": "#244aa5", // Kosovo blue
  CUB: "#002a8f", // blue triangle
  CYP: "#d57800", // copper map — copper/orange
  CZE: "#11457e", // blue triangle
  DEU: "#ffce00", // black/red/gold — gold band
  DJI: "#6ab2e7", // light blue/green — light blue
  DNK: "#c8102e", // red with white cross
  DOM: "#002d62", // blue cross quadrants
  DZA: "#006233", // green/white — green hoist
  ECU: "#ffd100", // yellow wider band
  EGY: "#ce1126", // red/white/black — red stripe
  ERI: "#ea0437", // green/red/blue — red triangle
  ESH: "#007a3d", // green/white/black — green
  ESP: "#aa151b", // red/yellow — red bands
  EST: "#0072ce", // blue/black/white — blue band
  ETH: "#078930", // green/yellow/red — green
  FIN: "#003580", // blue cross on white
  FJI: "#68bce2", // light blue ensign
  FLK: "#00247d", // British blue ensign
  FRA: "#002395", // tricolor even — navy blue
  GAB: "#009e60", // green/yellow/blue — green
  GBR: "#cf142b", // Union Jack red
  GEO: "#ff0000", // white with red cross
  GHA: "#006b3f", // red/gold/green — green
  GIN: "#ce1126", // red/yellow/green — red
  GMB: "#3a7728", // red/blue/green — green
  GNB: "#fcd116", // yellow/green/red — yellow star
  GNQ: "#3e9a00", // green/white/red/blue — green
  GRC: "#0d5eaf", // blue and white stripes
  GRL: "#c8102e", // red/white — red half (white is invisible on dark map)
  GTM: "#4997d0", // blue/white — blue stripes
  GUF: "#002395", // French blue
  GUY: "#009e49", // green with red triangle
  HND: "#0073cf", // blue/white — blue bands
  HRV: "#171796", // red/white/blue — blue band
  HTI: "#00209f", // blue/red — blue hoist
  HUN: "#477050", // red/white/green — green band
  IDN: "#ff0000", // red/white — red field
  IND: "#ff9933", // saffron/white/green — saffron
  IRL: "#169b62", // green/white/orange — green
  IRN: "#239f40", // green/white/red — green
  IRQ: "#ce1126", // red/white/black — red
  ISL: "#02529c", // blue cross on white
  ISR: "#0038b8", // blue Star of David
  ITA: "#009246", // green/white/red — green
  JAM: "#009b3a", // green/gold/black — green triangle
  JOR: "#007a3d", // black/white/green/red — green
  JPN: "#bc002d", // red sun
  KAZ: "#00afca", // sky blue field
  KEN: "#006600", // black/red/green — green
  KGZ: "#e8112d", // red field
  KHM: "#032ea1", // blue/red — blue bands
  KOR: "#003478", // South Korea — blue yin
  KWT: "#007a3d", // green/white/red/black — green
  LAO: "#ce1126", // red/blue/white — red
  LBN: "#ed1c24", // red/white cedar — red bands
  LBR: "#bf0a30", // red/white/blue — red stripes
  LBY: "#239e46", // red/black/green — green
  LKA: "#8d153a", // maroon/gold/green — maroon
  LSO: "#00209f", // blue/white/green — blue
  LTU: "#fdb913", // yellow/green/red — yellow
  LUX: "#ed2939", // red/white/light blue — red
  LVA: "#9e3039", // maroon/white — maroon
  MAR: "#c1272d", // red with green star
  MDA: "#0046ae", // blue/yellow/red — blue
  MDG: "#fc3d32", // white/red/green — red
  MEX: "#006847", // green/white/red — green
  MKD: "#d20000", // red sun
  MLI: "#14b53a", // green/yellow/red — green
  MLT: "#cf142b", // white/red — red bands
  MMR: "#fecb00", // yellow/green/red — yellow
  MNE: "#c40308", // red/gold — red
  MNG: "#da2032", // red/blue — red bands
  MOZ: "#007168", // green/black/yellow/red — green
  MRT: "#006233", // green with gold/red
  MWI: "#ce1126", // black/red/green — red sun
  MYS: "#cc0001", // red/white/blue — red stripes
  NAM: "#003580", // blue/red/green — blue triangle
  NCL: "#002395", // French blue
  NER: "#e05206", // orange/white/green — orange
  NGA: "#008751", // green/white — green
  NIC: "#0067c6", // blue/white — blue
  NLD: "#ff6600", // red/white/blue even — Dutch orange
  NOR: "#002868", // red/white/blue — navy blue
  NPL: "#dc143c", // crimson triangle
  NZL: "#00247d", // blue ensign
  OMN: "#db161b", // red/white/green — red
  PAK: "#01411c", // green with white stripe
  PAN: "#005293", // blue/red/blue — blue
  PER: "#d91023", // red/white — red
  PHL: "#0038a8", // blue/red — blue
  PNG: "#fcc010", // black/red — gold bird
  POL: "#dc143c", // white/red — red
  PRI: "#ed0000", // red/white/blue — red
  PRK: "#024fa2", // blue/red/white — blue
  PRT: "#006600", // green/red — green
  PRY: "#0038a8", // red/white/blue — blue
  PSE: "#007a3d", // black/white/green/red — green
  QAT: "#8d1b3d", // maroon
  ROU: "#002b7f", // blue/yellow/red — blue
  RUS: "#0039a6", // white/blue/red — blue band
  RWA: "#20603d", // blue/yellow/green — green
  SAU: "#006c35", // green field
  SDN: "#d21034", // red/white/black/green — red
  SEN: "#00853f", // green/yellow/red — green
  SLB: "#0051ba", // blue/green — blue
  SLE: "#1eb53a", // green/white/blue — green
  SLV: "#0047ab", // blue/white — blue
  SOM: "#4189dd", // light blue star
  SRB: "#c6363c", // red/blue/white — red
  SSD: "#078930", // black/red/green — green
  SUR: "#377e3f", // green/white/red — green
  SVK: "#0b4ea2", // white/blue/red — blue
  SVN: "#005da4", // white/blue/red — blue
  SWE: "#006aa7", // blue with yellow cross
  SWZ: "#3e5eb9", // blue/yellow/red — blue
  SYR: "#ce1126", // red/white/black/green — red
  TCD: "#002664", // blue/yellow/red — blue
  TGO: "#006a4e", // green/yellow/red — green
  THA: "#a51931", // red/white/blue — red
  TJK: "#006600", // red/white/green — green
  TKM: "#00843d", // green field
  TLS: "#dc241f", // red/yellow/black — red
  TTO: "#ce1126", // red/black — red
  TUN: "#e70013", // red field
  TUR: "#e30a17", // red with white crescent
  TWN: "#fe0000", // red field blue canton
  TZA: "#1eb53a", // green/yellow/black/blue — green
  UGA: "#fcd116", // black/yellow/red — yellow
  UKR: "#005bbb", // blue/yellow — blue
  URY: "#0038a8", // white/blue stripes
  USA: "#3c3b6e", // red/white/blue even — navy blue
  UZB: "#1eb53a", // blue/white/green/red — green
  VEN: "#cf142b", // yellow/blue/red — red
  VNM: "#da251d", // red with yellow star
  VUT: "#009543", // red/green/black/yellow — green
  YEM: "#ce1126", // red/white/black — red
  ZAF: "#007a4d", // green/gold/black — green
  ZMB: "#198a00", // green with orange eagle
  ZWE: "#006400", // green/yellow/red/black — green
};

/** Theme fallback when ISO is unknown. */
const DEFAULT_ACCENT = "#fbbf24";

export function countryFlagAccent(iso: string | null | undefined): string {
  if (!iso) return DEFAULT_ACCENT;
  return COUNTRY_FLAG_ACCENT[iso] ?? DEFAULT_ACCENT;
}