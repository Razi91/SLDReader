import { Style, Stroke } from 'ol/style';

import { hexToRGB, memoizeStyleFunction } from './styleUtils';

/**
 * @private
 * @param  {LineSymbolizer} linesymbolizer [description]
 * @return {object} openlayers style
 */
function lineStyle(linesymbolizer) {
  let style = {};
  if (linesymbolizer.stroke) {
    style = linesymbolizer.stroke.styling;
  }
  return new Style({
    stroke: new Stroke({
      color:
        style.strokeOpacity && style.stroke && style.stroke.slice(0, 1) === '#'
          ? hexToRGB(style.stroke, style.strokeOpacity)
          : style.stroke || '#3399CC',
      width: style.strokeWidth || 1.25,
      lineCap: style.strokeLinecap && style.strokeLinecap,
      lineDash: style.strokeDasharray && style.strokeDasharray.split(' '),
      lineDashOffset: style.strokeDashoffset && style.strokeDashoffset,
      lineJoin: style.strokeLinejoin && style.strokeLinejoin,
    }),
  });
}

const cachedLineStyle = memoizeStyleFunction(lineStyle);
function getLineStyle(symbolizer /* , feature, options = {} */) {
  return cachedLineStyle(symbolizer);
}

export default getLineStyle;
