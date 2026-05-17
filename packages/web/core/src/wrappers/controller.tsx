import { createLogicWrapper } from '../engine/logic-wrapper';
import type { IControllerWrapper } from './interfaces';

export const ControllerWrapper: IControllerWrapper = createLogicWrapper('controller');
