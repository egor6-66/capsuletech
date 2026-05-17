import { createLogicWrapper } from '../engine/logic-wrapper';
import type { IFeatureWrapper } from './interfaces';

export const FeatureWrapper: IFeatureWrapper = createLogicWrapper('feature');
