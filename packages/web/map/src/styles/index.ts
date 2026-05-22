import type { StyleSpecification } from 'maplibre-gl';

import darkMatter from './dark-matter.json' with { type: 'json' };
import positron from './positron.json' with { type: 'json' };

/**
 * Дефолтный светлый стиль карты — CARTO Positron (raster + vector).
 * Никаких API-ключей, attribution прилетает внутри style.
 */
export const POSITRON: StyleSpecification = positron as unknown as StyleSpecification;

/**
 * Дефолтный тёмный стиль карты — CARTO Dark Matter.
 */
export const DARK_MATTER: StyleSpecification = darkMatter as unknown as StyleSpecification;
