import { Animate } from './animate';
import { Resizable } from './resizable';
import { Status } from './status';

type WrapperWithStaticProps = {
  Status: typeof Status;
  Animate: typeof Animate;
  Resizable: typeof Resizable;
};

const Wrapper = {} as WrapperWithStaticProps;
Wrapper.Status = Status;
Wrapper.Animate = Animate;
Wrapper.Resizable = Resizable;

export type { AnimateVariant, IAnimateProps } from './animate';
export type { IResizableItem, IResizableProps, ResizableOrientation } from './resizable';
export { Animate, Resizable, Status, Wrapper };
