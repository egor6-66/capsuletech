import { Card as CardComponent } from './card';
import { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './parts';

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

export type * as ICard from './interfaces';
export { Card };
