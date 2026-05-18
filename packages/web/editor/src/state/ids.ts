const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Короткий случайный id для нод в дереве. По умолчанию 10 символов —
 * collision-rate приемлемая для редактора. Не зависит от crypto — работает
 * в любой среде, включая SSR-сборку.
 */
export const generateId = (length = 10): string => {
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
};

export const ROOT_ID = 'root';
