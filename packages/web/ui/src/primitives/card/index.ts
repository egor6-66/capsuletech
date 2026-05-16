import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './parts';

import { Card as CardComponent } from './card';

type CardWithStaticProps = typeof CardComponent & {
  Content: typeof CardContent;
  Description: typeof CardDescription;
  Footer: typeof CardFooter;
  Header: typeof CardHeader;
  Title: typeof CardTitle;
};

const Card = CardComponent as CardWithStaticProps;
Card.Content = CardContent;
Card.Description = CardDescription;
Card.Footer = CardFooter;
Card.Header = CardHeader;
Card.Title = CardTitle;

export { Card };
export type * as ICard from './interfaces';
