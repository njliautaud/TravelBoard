/**
 * Centralized API utilities for route handlers.
 *
 * Provides:
 * - Standardized error responses
 * - API key validation
 * - Request body parsing with error handling
 * - Auth wrappers
 * - Country name to ISO-2 mapping (shared across deal routes)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, type AuthUser } from "./unified-auth";

// ─── Standardized Error Responses ───────────────────────────────────────────

export interface ApiError {
  error: string;
  code?: string;
  status: number;
}

/**
 * Create a standardized JSON error response.
 */
export function apiError(
  message: string,
  status: number,
  code?: string,
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code, status }, { status });
}

/**
 * Wrap a route handler with try/catch, returning standardized error responses
 * for unhandled exceptions.
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T | ApiError>> {
  return handler().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[API Error]", message, err);
    return apiError(message, 500, "INTERNAL_ERROR");
  });
}

// ─── Auth Helpers ───────────────────────────────────────────────────────────

/**
 * Require authentication. Returns the user or a 401 response.
 */
export async function requireAuth(): Promise<
  | { user: AuthUser; error?: never }
  | { user?: never; error: NextResponse<ApiError> }
> {
  const user = await getAuthUser();
  if (!user) {
    return { error: apiError("Unauthorized", 401, "UNAUTHORIZED") };
  }
  return { user };
}

/**
 * Optionally get the authenticated user. Returns null if not authenticated
 * (does not return an error response).
 */
export async function optionalAuth(): Promise<AuthUser | null> {
  return getAuthUser();
}

// ─── Request Parsing ────────────────────────────────────────────────────────

/**
 * Safely parse JSON request body. Returns the parsed body or a 400 error response.
 */
export async function parseJsonBody<T = Record<string, unknown>>(
  req: NextRequest,
): Promise<
  | { body: T; error?: never }
  | { body?: never; error: NextResponse<ApiError> }
> {
  try {
    const body = await req.json();
    if (body === null || body === undefined) {
      return { error: apiError("Request body is required", 400, "INVALID_BODY") };
    }
    return { body: body as T };
  } catch {
    return { error: apiError("Invalid JSON in request body", 400, "INVALID_JSON") };
  }
}

// ─── API Key Validation ─────────────────────────────────────────────────────

/**
 * Validate an API key from request headers against an environment variable.
 *
 * @param req - The incoming request
 * @param headerName - Header name to check (e.g., "x-api-key", "x-ingest-key")
 * @param envVar - Environment variable name holding the expected key
 * @returns true if valid, false if invalid or missing
 */
export function validateApiKey(
  req: NextRequest,
  headerName: string,
  envVar: string,
): boolean {
  const expected = process.env[envVar];
  if (!expected) return false;
  const provided = req.headers.get(headerName);
  if (!provided) return false;
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Require a valid API key, returning a 401 error response if invalid.
 */
export function requireApiKey(
  req: NextRequest,
  headerName: string,
  envVar: string,
): NextResponse<ApiError> | null {
  if (!validateApiKey(req, headerName, envVar)) {
    return apiError(
      `Invalid or missing ${headerName} header`,
      401,
      "INVALID_API_KEY",
    );
  }
  return null;
}

// ─── Country Name to ISO-2 Mapping ──────────────────────────────────────────

/**
 * Comprehensive country name to ISO 3166-1 alpha-2 mapping.
 * Shared by deals/countries and deals/routes to avoid duplication.
 */
const COUNTRY_NAME_TO_ISO2: Record<string, string> = {
  "USA": "US", "United States": "US", "US": "US",
  "Canada": "CA", "Mexico": "MX", "Brazil": "BR", "Argentina": "AR",
  "UK": "GB", "United Kingdom": "GB", "France": "FR", "Germany": "DE",
  "Spain": "ES", "Italy": "IT", "Netherlands": "NL", "Switzerland": "CH",
  "Turkey": "TR", "Türkiye": "TR", "UAE": "AE", "United Arab Emirates": "AE", "Qatar": "QA",
  "Japan": "JP", "South Korea": "KR", "China": "CN", "Singapore": "SG",
  "Australia": "AU", "New Zealand": "NZ",
  "Thailand": "TH", "Indonesia": "ID", "Malaysia": "MY", "Philippines": "PH",
  "India": "IN", "Pakistan": "PK",
  "Egypt": "EG", "South Africa": "ZA", "Kenya": "KE", "Morocco": "MA",
  "Colombia": "CO", "Peru": "PE", "Chile": "CL", "Ecuador": "EC",
  "Costa Rica": "CR", "Panama": "PA", "Jamaica": "JM",
  "Dominican Republic": "DO", "Cuba": "CU", "Puerto Rico": "PR",
  "Iceland": "IS", "Norway": "NO", "Sweden": "SE", "Denmark": "DK",
  "Finland": "FI", "Ireland": "IE", "Portugal": "PT", "Greece": "GR",
  "Austria": "AT", "Belgium": "BE", "Czech Republic": "CZ", "Czechia": "CZ",
  "Poland": "PL", "Hungary": "HU", "Romania": "RO", "Croatia": "HR",
  "Bulgaria": "BG", "Serbia": "RS",
  "Israel": "IL", "Jordan": "JO", "Lebanon": "LB", "Oman": "OM",
  "Saudi Arabia": "SA", "Kuwait": "KW", "Bahrain": "BH",
  "Vietnam": "VN", "Cambodia": "KH", "Myanmar": "MM", "Laos": "LA",
  "Taiwan": "TW", "Hong Kong": "HK", "Macau": "MO",
  "Russia": "RU", "Ukraine": "UA", "Georgia": "GE", "Armenia": "AM",
  "Sri Lanka": "LK", "Nepal": "NP", "Bangladesh": "BD",
  "Nigeria": "NG", "Ghana": "GH", "Ethiopia": "ET", "Tanzania": "TZ",
  "Fiji": "FJ", "Maldives": "MV", "Mauritius": "MU", "Seychelles": "SC",
  "Belize": "BZ", "Guatemala": "GT", "Honduras": "HN", "Nicaragua": "NI",
  "El Salvador": "SV", "Uruguay": "UY", "Paraguay": "PY", "Bolivia": "BO",
  "Venezuela": "VE", "Guyana": "GY", "Suriname": "SR",
  "Luxembourg": "LU", "Malta": "MT", "Cyprus": "CY", "Estonia": "EE",
  "Latvia": "LV", "Lithuania": "LT", "Slovakia": "SK", "Slovenia": "SI",
  "Bosnia and Herzegovina": "BA", "North Macedonia": "MK", "Montenegro": "ME",
  "Albania": "AL", "Moldova": "MD", "Belarus": "BY",
  "Algeria": "DZ", "Tunisia": "TN", "Libya": "LY", "Sudan": "SD",
  "Senegal": "SN", "Ivory Coast": "CI", "Côte d'Ivoire": "CI",
  "Cameroon": "CM", "Uganda": "UG", "Rwanda": "RW", "Mozambique": "MZ",
  "Madagascar": "MG", "Zambia": "ZM", "Zimbabwe": "ZW", "Botswana": "BW",
  "Namibia": "NA", "Angola": "AO",
  "Iraq": "IQ", "Iran": "IR", "Afghanistan": "AF", "Uzbekistan": "UZ",
  "Kazakhstan": "KZ", "Azerbaijan": "AZ",
  "Mongolia": "MN", "Brunei": "BN",
  "Papua New Guinea": "PG", "Samoa": "WS", "Tonga": "TO",
  "Trinidad and Tobago": "TT", "Barbados": "BB", "Bahamas": "BS",
  "Bermuda": "BM", "Cayman Islands": "KY",
  "French Polynesia": "PF", "New Caledonia": "NC",
};

/**
 * Convert a country name to its ISO 3166-1 alpha-2 code.
 */
export function countryNameToISO2(name: string): string | null {
  return COUNTRY_NAME_TO_ISO2[name] ?? null;
}
