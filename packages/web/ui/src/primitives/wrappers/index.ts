import { Animate } from './animate';
import { Status } from './status';

type WrapperWithStaticProps = {
  Status: typeof Status;
  Animate: typeof Animate;
};

const Wrapper = {} as WrapperWithStaticProps;
Wrapper.Status = Status;
Wrapper.Animate = Animate;

export { Wrapper, Animate, Status };
export type { AnimateVariant, IAnimateProps } from './animate';
