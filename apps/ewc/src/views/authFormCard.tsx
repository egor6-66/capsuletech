/**
 * AuthFormCard — stateless template для auth-форм (login/register).
 * Flat props (без вложенности через Shape) — Widget передаёт напрямую.
 *
 * Meta-tags для controller binding:
 *   login input: @input + name="login"
 *   password input: @input + name="password"
 *   submit button: @submit
 */
const AuthFormCard = View(({ Card, Field, Input, Button, Link, Typography }, props) => (
  <Card class="w-96">
    <Card.Header>
      <Card.Title class="text-center">{props.title}</Card.Title>
    </Card.Header>
    <Card.Content class="flex flex-col gap-cell">
      <Field>
        <Field.Label>Login</Field.Label>
        <Field.Content>
          <Input meta={{ tags: ['@input', 'login'], name: 'login' }} />
        </Field.Content>
      </Field>

      <Field>
        <Field.Label>Password</Field.Label>
        <Field.Content>
          <Input type="password" meta={{ tags: ['@input', 'password'], name: 'password' }} />
        </Field.Content>
      </Field>

      <Button meta={{ tags: ['@submit'] }} class="mt-cell">
        {props.submitLabel}
      </Button>

      <Typography variant="p" class="text-center">
        {props.hintText} <Link to={props.hintLinkTo}>{props.hintLinkLabel}</Link>
      </Typography>
    </Card.Content>
  </Card>
));

export default AuthFormCard;
