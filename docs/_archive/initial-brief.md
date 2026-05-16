я делаю свой фреймворк поверх реакт тайпскрипт, архитектура будет базироваться на fsd, я назвал его capsule! суть в том что бы инкапсулировать базовые настройки вэб приложения, скрыть от разработчика вит конфиг, конфиги линтеров, тайпскрипт конфиг и тд. дать разработчику пару конфигов черз которые он сможет уже более узко чтото настроить, но вся база будет из коробки! также будет запрещенно устанавливать либы или юзать нативные js методы. только то что дает фреймворк. также само взаиммодействие будет подругому, небудет стэйта и перерендеров. каждый комонент будет иметь свое состояние через прокмси valtio а управление и изминение компонента будет через него! сама архитектура фреймворка все разбито на пакеты, есть базовый кор, который дает cli и уже через него мы создаем проект запускаем девсервер и импортируем то что нужно. я уже придумал кое что, хок Render import * as UI from '@capsuletech/ui';

import type { ReactNode } from 'react';

export const Render = <P extends object>(
  renderFn: (components: typeof UI, props: P) => ReactNode,
) => {
  return (props: P) => {
    return <>{renderFn(UI, props)}</>;
  };
};
он ипортирует все компоненты из пакета юай и возвращает, вот как используется import { Render } from '@capsuletech';

export const Fields = Render(({ Field, Input }) => {
    return (
        <Field.Group>
            <Field>
                <Field.Label>login</Field.Label>
                <Input name="login" type="login" placeholder="support" required />
            </Field>
            <Field>
                <Field.Label>password</Field.Label>
                <Input name="password" type="password" placeholder="xxxxxxxx" required />
            </Field>
        </Field.Group>
    );
});
это форма находится в entities/viewer/render/fields.tsx, а вот кнопки entities/viewer/render/authButtons.tsx import { Render } from '@capsuletech';

export const AuthButtons = Render(({ Field, Button }) => {
  return (
    <Field.Set>
      <Field.Group>
        <Button name={'login'} asChild className={'w-full'}>
          login
        </Button>
      </Field.Group>
      <Field.Group>
        <Button name={'registration'} className={'w-full'}>
          registration
        </Button>
        <Button name={'forgotPass'} className={'w-full'}>
          forgot your password?
        </Button>
      </Field.Group>
    </Field.Set>
  );
});

 теперь что бы с этим работать нужно создать фичу, например features/auth/login.tsx import { Feature } from '@capsuletech';

export const Login = Feature(({ authForm, authButtons }) => {
  return {
    authButtons: {
        login: {
            onClick: () => {
                console.log(`login:${authForm.login.value}, password:${authForm.password.value}`)
            }
        }
    },
  };
});
тут я обрабатываю клик кнопки, и получаю данные из инпутов authForm, это будет храниться в общем стейте с прокси valtio по названию компанента! прокси будет только на компоненты типо Field , тоесть через прокси я смогу ходить по филдам группам и набором групп Field.Set и получать измень значение! при этом момент  return {
    authButtons: {
      login: {
        onClick: () => {
          console.log(`login:${authForm.login.value}, password:${authForm.password.value}`);
        },
      },
    },
  };я обработал только кнопку логин. значит остальные кнопки не должны появиться в интерфейсе! дальше идет виджет widgets/login.tsx import { Widget } from '@capsuletech';

export const LoginWidget = Widget(({ Login }, { Card }) => {
  return (
    <Card>
      <Card.Title>login</Card.Title>
      <Card.Content>
        <Login />
      </Card.Content>
      <Card.Footer>footer</Card.Footer>
    </Card>
  );
});
тут я первым аргументом принимаю все фичи а вторым все компоненты доступные для виджета, в виджете уже не будет логики только компановка фич, какие то заголовки и тд, ну и дальше уже эти виджеты раставляются внутри конкретнойстраници! кактебе идея? если есть вопросы или нужно скинуть еще какой то код или что то уточнить то давай! потом у меня будет пару вопросов к тебе
