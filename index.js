export * from "./src/layers.js";
export * as utils from "./src/utils.js";

import { registerFilter } from "./src/layers.js";
import * as _filters from "./src/filters.js";

registerFilter("grayscale", _filters.GrayscaleFilter);
registerFilter("displacment", _filters.DisplacementFilter);
registerFilter("contrast", _filters.ContrastFilter);
registerFilter("curves", _filters.CurvesFilter);
registerFilter("projection", _filters.ProjectionFilter);

export const filters = _filters;
