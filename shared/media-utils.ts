/**
 * Utilidades unificadas para manejo de media principal
 * Usadas tanto en cliente como servidor para garantizar consistencia
 */

export interface MediaItem {
  id?: string;
  type: 'photo' | 'video';
  url?: string;
  file?: File;
  previewUrl?: string;
  isMain?: boolean;
  isNew?: boolean;
  deleted?: boolean;
  toDelete?: boolean;
  order?: number;
  uploading?: boolean;
  uploadProgress?: number;
  errorMessage?: string;
  fileIndex?: number;
}

export interface MainMediaResult {
  mainMediaUrl: string | null;
  mainMediaType: 'photo' | 'video' | null;
  mediaItems: MediaItem[];
}

/**
 * Valida si un elemento multimedia es válido para ser principal
 */
export function isValidMainMedia(item: MediaItem): boolean {
  if (!item) return false;
  if (item.deleted || item.toDelete) return false;
  if (item.errorMessage) return false;
  if (!item.url && !item.file && !item.previewUrl) return false;
  return true;
}

/**
 * Encuentra el mejor candidato para ser media principal
 */
export function findBestMainMediaCandidate(items: MediaItem[]): MediaItem | null {
  if (!Array.isArray(items) || items.length === 0) return null;

  // Filtrar solo elementos válidos
  const validItems = items.filter(isValidMainMedia);
  if (validItems.length === 0) return null;

  // 1. Prioridad: elemento ya marcado como principal y válido
  const explicitMain = validItems.find(item => item.isMain === true);
  if (explicitMain) return explicitMain;

  // 2. Fallback: primer elemento válido (por orden)
  const sortedItems = validItems.sort((a, b) => (a.order || 0) - (b.order || 0));
  return sortedItems[0];
}

/**
 * Establece un elemento como principal y asegura que solo uno sea principal
 */
export function setMainMediaItem(items: MediaItem[], targetIndex: number): MediaItem[] {
  if (!Array.isArray(items) || targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const targetItem = items[targetIndex];
  if (!isValidMainMedia(targetItem)) {
    console.warn('Cannot set invalid item as main media:', targetItem);
    return items;
  }

  // Crear nueva copia con solo el elemento target marcado como principal
  return items.map((item, index) => ({
    ...item,
    isMain: index === targetIndex
  }));
}

/**
 * Normaliza y valida array de mediaItems, asegurando que haya un elemento principal válido
 */
export function normalizeMediaItems(items: any[]): MainMediaResult {
  if (!Array.isArray(items)) {
    return {
      mainMediaUrl: null,
      mainMediaType: null,
      mediaItems: []
    };
  }

  // Filtrar elementos válidos
  const validItems: MediaItem[] = items
    .filter(item => item && typeof item === 'object')
    .map((item, index) => ({
      ...item,
      order: item.order !== undefined ? item.order : index,
      type: item.type || 'photo'
    }))
    .filter(isValidMainMedia);

  if (validItems.length === 0) {
    return {
      mainMediaUrl: null,
      mainMediaType: null,
      mediaItems: []
    };
  }

  // Asegurar que solo un elemento sea principal
  const mainCandidate = findBestMainMediaCandidate(validItems);
  const normalizedItems = validItems.map(item => ({
    ...item,
    isMain: item === mainCandidate
  }));

  // Extraer información del elemento principal
  let mainMediaUrl: string | null = null;
  let mainMediaType: 'photo' | 'video' | null = null;

  if (mainCandidate) {
    mainMediaUrl = mainCandidate.url || null;
    mainMediaType = mainCandidate.type;
  }

  return {
    mainMediaUrl,
    mainMediaType,
    mediaItems: normalizedItems
  };
}

/**
 * Parsea mediaItems desde JSON de forma segura
 */
export function parseMediaItemsFromJSON(input: any): MediaItem[] {
  if (!input) return [];

  // Si ya es un array, usarlo directamente
  if (Array.isArray(input)) {
    return input.filter(item => item && typeof item === 'object');
  }

  // Si es string, intentar parsear JSON
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to parse mediaItems JSON:', e);
      return [];
    }
  }

  // Si es un objeto único, convertir a array
  if (typeof input === 'object') {
    return [input];
  }

  return [];
}

/**
 * Serializa mediaItems a JSON de forma segura
 */
export function serializeMediaItemsToJSON(items: MediaItem[]): string {
  if (!Array.isArray(items) || items.length === 0) {
    return JSON.stringify([]);
  }

  // Limpiar elementos para serialización (remover File objects y URLs temporales)
  const cleanItems = items.map(item => ({
    type: item.type,
    url: item.url,
    order: item.order || 0,
    isMain: item.isMain || false,
    id: item.id
  })).filter(item => item.url); // Solo incluir items con URL válida

  return JSON.stringify(cleanItems);
}