export type NullableNumber = number | null | undefined;

/**
 * Si el backend marca el límite como "ilimitado" suele venir como `null`.
 */
export function isLimitUnlimited(limit: NullableNumber): boolean {
  return limit === null || limit === undefined;
}

/**
 * Busca el primer valor de límite que exista en `limits` para una lista de claves.
 * Si ninguna existe, devuelve `undefined` (se interpreta como ilimitado).
 */
export function getLimitValue(
  limits: Record<string, NullableNumber> | undefined,
  candidateKeys: string[]
): NullableNumber {
  if (!limits) return undefined;
  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(limits, key)) {
      return limits[key];
    }
  }
  return undefined;
}

/**
 * Regla genérica de gating UI:
 * - si `limit` es null/undefined => permitido
 * - si es número => permitido solo si (current + delta) <= limit
 */
export function canUseLimit(currentUsage: number, limit: NullableNumber, delta: number): boolean {
  if (limit === null || limit === undefined) return true;
  return currentUsage + delta <= limit;
}

/**
 * Features habilitadas por el backend.
 * Si la clave no existe, por defecto asumimos "habilitado" para no bloquear flujos.
 */
export function isFeatureEnabled(
  features: Record<string, boolean> | undefined,
  featureKey: string
): boolean {
  if (!features) return true;
  if (!Object.prototype.hasOwnProperty.call(features, featureKey)) return true;
  return features[featureKey] === true;
}

/**
 * Menú / gating OR: visible si cualquiera de las claves está habilitada
 * (misma semántica que isFeatureEnabled para claves ausentes).
 */
export function isAnyFeatureEnabled(
  features: Record<string, boolean> | undefined,
  keys: string[]
): boolean {
  if (!keys.length) return true;
  return keys.some((k) => isFeatureEnabled(features, k));
}

/**
 * Gating estricto para menú: la clave debe existir en `features` y ser `true`.
 * Si aún no hay payload de features (`undefined`), no oculta (evita menú vacío al cargar).
 */
export function isMenuFeatureStrict(
  features: Record<string, boolean> | undefined,
  featureKey: string
): boolean {
  if (!features) return true;
  if (!Object.prototype.hasOwnProperty.call(features, featureKey)) return false;
  return features[featureKey] === true;
}

/** OR sobre claves estrictas (p. ej. páginas o grupos de Facebook). */
export function isAnyMenuFeatureStrict(
  features: Record<string, boolean> | undefined,
  keys: string[]
): boolean {
  if (!keys.length) return true;
  if (!features) return true;
  return keys.some((k) => isMenuFeatureStrict(features, k));
}

