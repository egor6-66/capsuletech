/**
 * AuthFormCard — stateless template для auth-форм (login/register).
 * Flat props (без вложенности через Shape) — Widget передаёт напрямую.
 *
 * Meta-tags (raw, без алиасов — алиасы только на query-стороне):
 *   login input    → ['login', 'input']     deriveName='login', матчится pick(['@input'])
 *   password input → ['password', 'input']  deriveName='password', deriveInputType→type=password,
 *                                           матчится pick(['@input'])
 *   submit button  → ['submit']             матчится pick(['@submit'])
 *
 * Порядок tags важен: deriveName берёт первый non-@ tag.
 * ID/имя ставим первым, type-маркер вторым.
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
          <Input meta={{ tags: ['login', 'input'] }} />
        </Field.Content>
      </Field>

      <Field>
        <Field.Label>Password</Field.Label>
        <Field.Content>
          <Input meta={{ tags: ['password', 'input'] }} />
        </Field.Content>
      </Field>

      <Button meta={{ tags: ['submit'] }} class="mt-cell">
        {props.submitLabel}
      </Button>

      <Typography variant="p" class="text-center">
        {props.hintText} <Link to={props.hintLinkTo}>{props.hintLinkLabel}</Link>
      </Typography>
    </Card.Content>
  </Card>
));

export default AuthFormCard;
