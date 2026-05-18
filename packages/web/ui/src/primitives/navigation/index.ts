import { Navigation as NavigationComponent, NavigationItem, NavigationList } from './navigation';

type NavigationWithStaticProps = typeof NavigationComponent & {
  List: typeof NavigationList;
  Item: typeof NavigationItem;
};

const Navigation = NavigationComponent as NavigationWithStaticProps;
Navigation.List = NavigationList;
Navigation.Item = NavigationItem;

export type * as INavigation from './interfaces';
export { Navigation, NavigationItem, NavigationList };
