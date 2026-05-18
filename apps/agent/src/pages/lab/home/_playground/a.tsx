/**
 * Папка `_playground` начинается с `_` → pathless: не попадает в URL.
 * Поэтому файл `_playground/a.tsx` отвечает за `/lab/home/a`, а не за
 * `/lab/home/_playground/a`.
 */
const A = Page(() => (
  <div class="space-y-2">
    <h2 class="text-lg font-semibold">/lab/home/a</h2>
    <p class="text-sm text-muted-foreground">
      файл <code>pages/lab/home/_playground/a.tsx</code> → <code>_playground</code> отрезано из URL.
    </p>
  </div>
));

export default A;
