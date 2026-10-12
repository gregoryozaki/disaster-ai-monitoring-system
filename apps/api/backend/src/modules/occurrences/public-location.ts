/*
 * Posição pública de uma ocorrência: arredondada para uma grade de 0,01°
 * (cerca de 1 km). Tudo o que é público (mapa, distância e filtro por raio)
 * usa só essa posição, nunca a coordenada exata informada pelo cidadão.
 * Senão, consultas com centros diferentes revelariam o ponto exato.
 */
const PUBLIC_COORDINATE_DECIMALS = 2

export function toPublicCoordinate(value: number) {
  return Number(value.toFixed(PUBLIC_COORDINATE_DECIMALS))
}
