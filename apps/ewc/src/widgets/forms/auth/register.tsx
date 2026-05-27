const Register = Widget(() => (
  <Features.Auth>
    <Views.AuthFormCard
      title="Sign up"
      submitLabel="Create account"
      hintText="Already have an account?"
      hintLinkLabel="Sign in"
      hintLinkTo="/login"
    />
  </Features.Auth>
));

export default Register;
