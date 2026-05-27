/**
 * _auth layout — централизованный фон для login/register pages.
 * `<Ui.Outlet/>` рендерит дочерние страницы.
 */
const Auth = Page((Ui) => (
  <Ui.Layout.Flex
    align="center"
    justify="center"
    class="min-h-screen bg-background"
  >
    <Ui.Outlet />
  </Ui.Layout.Flex>
));

export default Auth;
