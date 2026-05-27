/**
 * _public layout — раздел для неавторизованных (login, register, etc.).
 * Centered фон + `<Ui.Outlet/>` под дочерние страницы.
 *
 * URL-карта:
 *   `/login`    → _public/login.tsx
 *   `/register` → _public/register.tsx
 *   `/`         → этот файл (layout + passthrough index) — пустой Outlet,
 *                 без content. Заходить на `/` смысла нет; после login Feature
 *                 редиректит на `/workspace`.
 */
const Public = Page((Ui) => (
  <Ui.Layout.Flex align="center" justify="center" class="min-h-screen">
    <Ui.Outlet />
  </Ui.Layout.Flex>
));

export default Public;
