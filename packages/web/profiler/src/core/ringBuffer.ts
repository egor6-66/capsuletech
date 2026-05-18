export interface IRingBuffer<T> {
  push(item: T): void;
  toArray(): readonly T[];
  readonly length: number;
  readonly capacity: number;
  last(): T | undefined;
}

export function createRingBuffer<T>(capacity: number): IRingBuffer<T> {
  if (capacity <= 0) throw new Error('ringBuffer: capacity must be > 0');
  const buf: T[] = new Array(capacity);
  let head = 0;
  let size = 0;

  return {
    push(item) {
      buf[head] = item;
      head = (head + 1) % capacity;
      if (size < capacity) size++;
    },
    toArray() {
      if (size < capacity) return buf.slice(0, size);
      const out: T[] = new Array(size);
      for (let i = 0; i < size; i++) out[i] = buf[(head + i) % capacity];
      return out;
    },
    last() {
      if (size === 0) return undefined;
      return buf[(head - 1 + capacity) % capacity];
    },
    get length() {
      return size;
    },
    get capacity() {
      return capacity;
    },
  };
}
