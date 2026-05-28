import type { StyleSpecification } from 'maplibre-gl';

import darkMatter from './dark-matter.json' with { type: 'json' };
import positron from './positron.json' with { type: 'json' };

/**
 * Дефолтный светлый стиль карты — CARTO Positron (vector tiles, CARTO CDN).
 *
 * Встроен в бандл как JSON-объект — работает offline (тайлы CDN нужны только для
 * отображения тайлов, сам style spec доступен без сети).
 *
 * Attribution: © CARTO, © OpenStreetMap contributors.
 *
 * ВНИМАНИЕ: CARTO-стили НЕ содержат атрибут `render_height` в source-layer
 * `"building"`. Если нужны 3D-здания — используй `<BuildingsPreset>` с
 * OpenMapTiles-based стилем (OpenFreeMap, MapTiler), или передай кастомный
 * `style` prop в `<MapView>`.
 */
export const POSITRON: StyleSpecification = positron as unknown as StyleSpecification;

/**
 * Дефолтный тёмный стиль карты — CARTO Dark Matter (vector tiles, CARTO CDN).
 *
 * Встроен в бандл как JSON-объект — работает offline (тайлы CDN нужны только для
 * отображения тайлов, сам style spec доступен без сети).
 *
 * Attribution: © CARTO, © OpenStreetMap contributors.
 *
 * ВНИМАНИЕ: CARTO-стили НЕ содержат атрибут `render_height` в source-layer
 * `"building"`. Если нужны 3D-здания — используй `<BuildingsPreset>` с
 * OpenMapTiles-based стилем (OpenFreeMap, MapTiler), или передай кастомный
 * `style` prop в `<MapView>`.
 */
export const DARK_MATTER: StyleSpecification = darkMatter as unknown as StyleSpecification;
