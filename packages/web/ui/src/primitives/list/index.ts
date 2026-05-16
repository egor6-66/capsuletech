import { List as ListRoot } from './list';
// import { ListItem } from './ListItem';

export const List = Object.assign(ListRoot, {
  // Item: ListItem,
  Virtual: ListRoot.Virtual,
});
