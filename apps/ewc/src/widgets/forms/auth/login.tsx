const Login = Widget(() => (
  <Features.Auth>
    <Views.AuthFormCard
      title="Sign in"
      submitLabel="Sign in"
      hintText="Don't have an account?"
      hintLinkLabel="Register"
      hintLinkTo="/register"
    />
  </Features.Auth>
));

export default Login;
