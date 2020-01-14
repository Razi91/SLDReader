/* eslint-disable no-continue */
/* eslint-disable no-underscore-dangle */
import { Style, Fill, Stroke, Circle, Icon, RegularShape, Text } from 'ol/style';

import { IMAGE_LOADING, IMAGE_LOADED, IMAGE_ERROR } from './constants';
import { getRules, loadExternalGraphic, updateExternalGraphicRule } from './Utils';
import getGeometryStyles from './GeometryStyles';

// Global image cache. A map of image Url -> {
//   url: image url,
//   image: an Image instance containing image data,
//   width: image width in pixels,
//   height: image height in pixels
// }
const imageCache = {};

const defaultPointStyle = new Style({
  image: new Circle({
    radius: 8,
    fill: new Fill({
      color: 'blue',
      fillOpacity: 0.7,
    }),
  }),
});

const imageLoadingPointStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({
      color: '#DDDDDD',
    }),
    stroke: new Stroke({
      width: 1,
      color: '#888888',
    }),
  }),
});

const imageLoadingPolygonStyle = new Style({
  fill: new Fill({
    color: '#DDDDDD',
  }),
  stroke: new Stroke({
    color: '#888888',
    width: 1,
  }),
});

const imageErrorPointStyle = new Style({
  image: new RegularShape({
    angle: Math.PI / 4,
    fill: new Fill({
      color: 'red',
    }),
    points: 4,
    radius1: 8,
    radius2: 0,
    stroke: new Stroke({
      color: 'red',
      width: 4,
    }),
  }),
});

const imageErrorPolygonStyle = new Style({
  fill: new Fill({
    color: 'red',
  }),
  stroke: new Stroke({
    color: 'red',
    width: 1,
  }),
});

/**
 * @private
 * @param  {string} hex   eg #AA00FF
 * @param  {Number} alpha eg 0.5
 * @return {string}       rgba(0,0,0,0)
 */
function hexToRGB(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (alpha) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function createPattern(graphic) {
  const { image, width, height } = imageCache[graphic.externalgraphic.onlineresource];

  let imageRatio = 1;
  if (graphic.size && height !== graphic.size) {
    imageRatio = graphic.size / height;
  }
  const cnv = document.createElement('canvas');
  const ctx = cnv.getContext('2d');
  if (imageRatio === 1) {
    return ctx.createPattern(image, 'repeat');
  }
  const tempCanvas = document.createElement('canvas');
  const tCtx = tempCanvas.getContext('2d');

  tempCanvas.width = width * imageRatio;
  tempCanvas.height = height * imageRatio;
  tCtx.drawImage(image, 0, 0, width, height, 0, 0, width * imageRatio, height * imageRatio);
  return ctx.createPattern(tempCanvas, 'repeat');
}

function polygonStyle(style) {
  if (style.fill
        && style.fill.graphicfill
        && style.fill.graphicfill.graphic
        && style.fill.graphicfill.graphic.externalgraphic
        && style.fill.graphicfill.graphic.externalgraphic.onlineresource) {
    // Check symbolizer metadata to see if the image has already been loaded.
    switch (style.__loadingState) {
      case IMAGE_LOADED:
        return (new Style({
          fill: new Fill({
            color: createPattern(style.fill.graphicfill.graphic),
          }),
        }));
      case IMAGE_LOADING:
        return imageLoadingPolygonStyle;
      case IMAGE_ERROR:
        return imageErrorPolygonStyle;
      default:
        // A symbolizer should have loading state metadata, but return IMAGE_LOADING just in case.
        return imageLoadingPolygonStyle;
    }
  }

  const stroke = style.stroke && style.stroke.styling;
  const fill = style.fill && style.fill.styling;
  return new Style({
    fill:
      fill &&
      new Fill({
        color:
          fill.fillOpacity && fill.fill && fill.fill.slice(0, 1) === '#'
            ? hexToRGB(fill.fill, fill.fillOpacity)
            : fill.fill,
      }),
    stroke:
      stroke &&
      new Stroke({
        color:
          stroke.strokeOpacity &&
          stroke.stroke &&
          stroke.stroke.slice(0, 1) === '#'
            ? hexToRGB(stroke.stroke, stroke.strokeOpacity)
            : stroke.stroke || '#3399CC',
        width: stroke.strokeWidth || 1.25,
        lineCap: stroke.strokeLinecap && stroke.strokeLinecap,
        lineDash: stroke.strokeDasharray && stroke.strokeDasharray.split(' '),
        lineDashOffset: stroke.strokeDashoffset && stroke.strokeDashoffset,
        lineJoin: stroke.strokeLinejoin && stroke.strokeLinejoin,
      }),
  });
}

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

/**
 * Create an OL Icon style for an external graphic.
 * The Graphic must be already loaded and present in the global imageCache.
 * @param {string} imageUrl Url of the external graphic.
 * @param {number} size Requested size in pixels.
 */
function createCachedImageStyle(imageUrl, size) {
  const { image, width, height } = imageCache[imageUrl];
  return new Style({
    image: new Icon({
      img: image,
      imgSize: [width, height],
      // According to SLD spec, if size is given, image height should equal the given size.
      scale: size / height || 1,
    }),
  });
}

/**
 * @private
 * @param  {PointSymbolizer} pointsymbolizer [description]
 * @return {object} openlayers style
 */
function pointStyle(pointsymbolizer) {
  const { graphic: style } = pointsymbolizer;
  if (style.externalgraphic && style.externalgraphic.onlineresource) {
    // Check symbolizer metadata to see if the image has already been loaded.
    switch (pointsymbolizer.__loadingState) {
      case IMAGE_LOADED:
        return createCachedImageStyle(
          style.externalgraphic.onlineresource,
          style.size
        );
      case IMAGE_LOADING:
        return imageLoadingPointStyle;
      case IMAGE_ERROR:
        return imageErrorPointStyle;
      default:
        // A symbolizer should have loading state metadata, but return IMAGE_LOADING just in case.
        return imageLoadingPointStyle;
    }
  }
  let displacement = undefined;
  if (pointsymbolizer && pointsymbolizer.displacement) {
    const styleDisplacement = pointsymbolizer.displacement;
    const displacementX = styleDisplacement.displacementx ? styleDisplacement.displacementx : 0;
    const displacementY = styleDisplacement.displacementy ? styleDisplacement.displacementy : 0;
    displacement = [displacementX, displacementY]
  }

  if (style.mark) {
    let { fill, stroke } = style.mark;
    const fillColor = (fill && fill.styling && fill.styling.fill) || 'blue';
    fill = new Fill({
      color: fillColor,
    });
    if (stroke && stroke.styling && !(Number(stroke.styling.strokeWidth) === 0)) {
      const { stroke: cssStroke, strokeWidth: cssStrokeWidth } = stroke.styling;
      stroke = new Stroke({
        color: cssStroke || 'black',
        width: cssStrokeWidth || 2,
      });
    } else {
      stroke = undefined;
    }
    const radius = (0.5 * Number(style.size)) || 10;
    switch (style.mark.wellknownname) {
      case 'circle':
        return new Style({
          image: new Circle({
            fill,
            radius,
            stroke,
            displacement,
          }),
        });
      case 'triangle':
        return new Style({
          image: new RegularShape({
            fill,
            points: 3,
            radius,
            stroke,
            displacement,
          }),
        });
      case 'star':
        return new Style({
          image: new RegularShape({
            fill,
            points: 5,
            radius1: radius,
            radius2: radius / 2.5,
            stroke,
            displacement,
          }),
        });
      case 'cross':
        return new Style({
          image: new RegularShape({
            fill,
            points: 4,
            radius1: radius,
            radius2: 0,
            displacement,
            stroke:
              stroke ||
              new Stroke({
                color: fillColor,
                width: radius / 2,
              }),
          }),
        });
      case 'hexagon':
        return new Style({
          image: new RegularShape({
            fill,
            points: 6,
            radius1: radius,
            displacement,
            stroke:
              stroke ||
              new Stroke({
                color: fillColor,
                width: radius / 2,
              }),
          }),
        });
      case 'octagon':
        return new Style({
          image: new RegularShape({
            fill,
            points: 8,
            radius1: radius,
            displacement,
            stroke:
              stroke ||
              new Stroke({
                color: fillColor,
                width: radius / 2,
              }),
          }),
        });
      case 'x':
        return new Style({
          image: new RegularShape({
            angle: Math.PI / 4,
            fill,
            points: 4,
            radius1: radius,
            radius2: 0,
            displacement,
            stroke:
              stroke ||
              new Stroke({
                color: fillColor,
                width: radius / 2,
              }),
          }),
        });
      default:
        // Default is `square`
        return new Style({
          image: new RegularShape({
            angle: Math.PI / 4,
            fill,
            points: 4,
            displacement,
            // For square, scale radius so the height of the square equals the given size.
            radius: radius * Math.sqrt(2.0),
            stroke,
          }),
        });
    }
  }
  return new Style({
    image: new Circle({
      radius: 4,
      displacement,
      fill: new Fill({
        color: 'blue',
      }),
    }),
  });
}

/**
 * @private
 * @param  {TextSymbolizer} textsymbolizer [description]
 * @param {object|Feature} feature {@link http://geojson.org|geojson}
 *  or {@link https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html|ol/Feature}
 * @param {string} type geometry type, @see {@link http://geojson.org|geojson} for possible types
 * @return {object} openlayers style
 */
function textStyle(textsymbolizer, feature, type) {
  const properties = feature.getProperties
    ? feature.getProperties()
    : feature.properties;
  if (textsymbolizer && textsymbolizer.label) {
    const parseText = {
      text: part => part,
      propertyname: (part, props = {}) => props[part] || '',
    };
    const label = textsymbolizer.label.length
      ? textsymbolizer.label
      : [textsymbolizer.label];

    const text = label.reduce((string, part) => {
      const keys = Object.keys(part);
      return (
        string +
        (keys && parseText[keys[0]]
          ? parseText[keys[0]](part[keys[0]], properties)
          : '')
      );
    }, '');

    const fill = textsymbolizer.fill
      ? textsymbolizer.fill.styling
      : {};
    const halo =
      textsymbolizer.halo && textsymbolizer.halo.fill
        ? textsymbolizer.halo.fill.styling
        : {};
    const haloRadius =
      textsymbolizer.halo && textsymbolizer.halo.radius
        ? parseFloat(textsymbolizer.halo.radius)
        : 1;
    const {
      fontFamily = 'sans-serif',
      fontSize = 10,
      fontStyle = '',
      fontWeight = '',
    } =
      textsymbolizer.font && textsymbolizer.font.styling
        ? textsymbolizer.font.styling
        : {};

    const pointplacement =
      textsymbolizer &&
      textsymbolizer.labelplacement &&
      textsymbolizer.labelplacement.pointplacement
        ? textsymbolizer.labelplacement.pointplacement
        : {};
    const displacement =
      pointplacement && pointplacement.displacement
        ? pointplacement.displacement
        : {};
    const offsetX = displacement.displacementx ? displacement.displacementx : 0;
    const offsetY = displacement.displacementy ? displacement.displacementy : 0;
    const lineplacement =
      textsymbolizer &&
      textsymbolizer.labelplacement &&
      textsymbolizer.labelplacement.lineplacement
        ? textsymbolizer.labelplacement.lineplacement
        : null;
    const rotation = pointplacement.rotation ? pointplacement.rotation : 0;

    const placement = type !== 'point' && lineplacement ? 'line' : 'point';

    // Halo styling

    return new Style({
      text: new Text({
        text,
        font: `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`,
        offsetX: Number(offsetX),
        offsetY: Number(offsetY),
        rotation,
        placement,
        textAlign: 'center',
        textBaseline: 'middle',
        stroke: textsymbolizer.halo
          ? new Stroke({
            color:
                halo.fillOpacity && halo.fill && halo.fill.slice(0, 1) === '#'
                  ? hexToRGB(halo.fill, halo.fillOpacity)
                  : halo.fill,
            // wrong position width radius equal to 2 or 4
            width:
                (haloRadius === 2 || haloRadius === 4
                  ? haloRadius - 0.00001
                  : haloRadius) * 2,
          })
          : undefined,
        fill: new Fill({
          color:
            fill.fillOpacity && fill.fill && fill.fill.slice(0, 1) === '#'
              ? hexToRGB(fill.fill, fill.fillOpacity)
              : fill.fill,
        }),
      }),
    });
  }
  return new Style({});
}

// Create memoized versions of the style converters.
// They use a WeakMap to return the same OL style object if the symbolizer is the same.
// Note: this only works for constant symbolizers!
// Todo: find a smart way to optimize text symbolizers.

/**
 * Function to memoize style conversion functions that convert sld symbolizers to OpenLayers style instances.
 * The memoized version of the style converter returns the same OL style instance if the symbolizer is the same object.
 * Uses a WeakMap internally.
 * Note: This only works for constant symbolizers.
 * Note: Text symbolizers depend on the feature property and the geometry type, these cannot be cached in this way.
 * @private
 * @param {Function} styleFunction Function that accepts a single symbolizer object and returns the corresponding OpenLayers style object.
 * @returns {Function} The memoized function of the style conversion function.
 */
function memoize(styleFunction) {
  const styleCache = new WeakMap();

  return symbolizer => {
    let olStyle = styleCache.get(symbolizer);

    if (!olStyle) {
      olStyle = styleFunction(symbolizer);
      styleCache.set(symbolizer, olStyle);
    }

    return olStyle;
  };
}

// Memoized versions of point, line and polygon style converters.
const cachedPointStyle = memoize(pointStyle);
const cachedLineStyle = memoize(lineStyle);
const cachedPolygonStyle = memoize(polygonStyle);

const defaultStyles = [defaultPointStyle];


/**
 * Pushes style to array
 * @example pushTo(styles, point[j], cachedPointStyle);
 * @param {array} styles rulesconverter
 * @param {object} item style description of array of styles description
 * @param {function} cache function that returns cached style
 */
function pushTo(array, item, cache) {
  if (Array.isArray(item)) {
    for (let k = 0; k < item.length; k += 1) {
      array.push(cache(item[k]));
    }
  } else {
    array.push(cache(item));
  }
}

/**
 * Create openlayers style
 * @example OlStyler(getGeometryStyles(rules), geojson.geometry.type);
 * @param {GeometryStyles} GeometryStyles rulesconverter
 * @param {object|Feature} feature {@link http://geojson.org|geojson}
 *  or {@link https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html|ol/Feature} Changed in 0.0.04 & 0.0.5!
 * @return ol.style.Style or array of it
 */
export default function OlStyler(GeometryStyles, feature) {
  const geometry = feature.getGeometry
    ? feature.getGeometry()
    : feature.geometry;
  const type = geometry.getType ? geometry.getType() : geometry.type;
  const { polygon, line, point, text } = GeometryStyles;
  let styles = [];
  switch (type) {
    case 'Polygon':
    case 'MultiPolygon':
      for (let i = 0; i < polygon.length; i += 1) {
        pushTo(styles, polygon[i], cachedPolygonStyle);
      }
      for (let j = 0; j < text.length; j += 1) {
        styles.push(textStyle(text[j], feature, 'polygon'));
      }
      break;
    case 'LineString':
    case 'MultiLineString':
      for (let j = 0; j < line.length; j += 1) {
        pushTo(styles, line[j], cachedLineStyle);
      }
      for (let j = 0; j < text.length; j += 1) {
        styles.push(textStyle(text[j], feature, 'line'));
      }
      break;
    case 'Point':
    case 'MultiPoint':
      for (let j = 0; j < point.length; j += 1) {
        pushTo(styles, point[j], cachedPointStyle);
      }
      for (let j = 0; j < text.length; j += 1) {
        styles.push(textStyle(text[j], feature, 'point'));
      }
      break;
    default:
      styles = defaultStyles;
  }
  return styles;
}

/**
 * @private
 * Extract feature id from an OpenLayers Feature.
 * @param {Feature} feature {@link https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html|ol/Feature}
 * @returns {string} Feature id.
 */
function getOlFeatureId(feature) {
  return feature.getId();
}

/**
 * @private
 * Extract a property value from an OpenLayers Feature.
 * @param {Feature} feature {@link https://openlayers.org/en/latest/apidoc/module-ol_Feature-Feature.html|ol/Feature}
 * @param {string} propertyName The name of the feature property to read.
 * @returns {object} Property value.
 */
function getOlFeatureProperty(feature, propertyName) {
  return feature.get(propertyName);
}

/**
 * Start loading images used in rules that have a pointsymbolizer with an externalgraphic.
 * On image load start or load end, update __loadingState metadata of the symbolizers for that image url.
 * @param {Array<object>} rules Array of SLD rule objects that pass the filter for a single feature.
 * @param {FeatureTypeStyle} featureTypeStyle The feature type style object for a layer.
 * @param {object} imageLoadState Cache of image load state: imageUrl -> IMAGE_LOADING | IMAGE_LOADED | IMAGE_ERROR.
 * @param {Function} imageLoadedCallback Function to call when an image has loaded.
 */
function processExternalGraphicSymbolizers(
  rules,
  featureTypeStyle,
  imageLoadState,
  imageLoadedCallback
) {
  // If a feature has an external graphic point or polygon symbolizer, the external image may
  // * have never been requested before.
  //   --> set __loadingState IMAGE_LOADING on the symbolizer and start loading the image.
  //       When loading is complete, replace all symbolizers using that image inside the featureTypeStyle
  //       with new symbolizers with a new __loadingState. Also call options.imageLoadCallback if one has been provided.
  // * be loading.
  //   --> set __loadingState IMAGE_LOADING on the symbolizer if not already so.
  // * be loaded and therefore present in the image cache.
  //   --> set __loadingState IMAGE_LOADED on the symbolizer if not already so.
  // * be in error. Error is a kind of loaded, but with an error icon style.
  //   --> set __loadingState IMAGE_ERROR on the symbolizer if not already so.
  for (let k = 0; k < rules.length; k += 1) {
    const rule = rules[k];

    let symbolizer;
    let exgraphic;

    if (rule.pointsymbolizer
        && rule.pointsymbolizer.graphic
        && rule.pointsymbolizer.graphic.externalgraphic) {
      symbolizer = rule.pointsymbolizer;
      exgraphic = rule.pointsymbolizer.graphic.externalgraphic;
    } else if (rule.polygonsymbolizer
        && rule.polygonsymbolizer.fill
        && rule.polygonsymbolizer.fill.graphicfill
        && rule.polygonsymbolizer.fill.graphicfill.graphic
        && rule.polygonsymbolizer.fill.graphicfill.graphic.externalgraphic) {
      symbolizer = rule.polygonsymbolizer;
      exgraphic = rule.polygonsymbolizer.fill.graphicfill.graphic.externalgraphic;
    } else {
      continue;
    }

    const imageUrl = exgraphic.onlineresource;
    if (!(imageUrl in imageLoadState)) {
      // Start loading the image and set image load state on the symbolizer.
      imageLoadState[imageUrl] = IMAGE_LOADING;
      loadExternalGraphic(
        imageUrl,
        imageCache,
        imageLoadState,
        featureTypeStyle,
        imageLoadedCallback
      );
    } else if (
      // Change image load state on the symbolizer if it has changed in the meantime.
      symbolizer.__loadingState !== imageLoadState[imageUrl]
    ) {
      updateExternalGraphicRule(rule, imageUrl, imageLoadState[imageUrl]);
    }
  }
}

/**
 * Create an OpenLayers style function from a FeatureTypeStyle object extracted from an SLD document.
 *
 * **Important!** When using externalGraphics for point styling, make sure to call .changed() on the layer
 * inside options.imageLoadedCallback to immediately see the loaded image. If you do not do this, the
 * image icon will only become visible the next time OpenLayers draws the layer (after pan or zoom).
 * @param {FeatureTypeStyle} featureTypeStyle Feature Type Style object.
 * @param {object} options Options
 * @param {function} options.convertResolution An optional function to convert the resolution in map units/pixel to resolution in meters/pixel.
 * When not given, the map resolution is used as-is.
 * @param {function} options.imageLoadedCallback Optional callback that will be called with the url of an externalGraphic when
 * an image has been loaded (successfully or not). Call .changed() inside the callback on the layer to see the loaded image.
 * @returns {Function} A function that can be set as style function on an OpenLayers vector style layer.
 * @example
 * myOlVectorLayer.setStyle(SLDReader.createOlStyleFunction(featureTypeStyle, {
 *   imageLoadedCallback: () => { myOlVectorLayer.changed(); }
 * }));
 */
export function createOlStyleFunction(featureTypeStyle, options = {}) {
  const imageLoadedCallback = options.imageLoadedCallback || (() => {});

  // Keep image loading state separate from image cache.
  // This makes it easier to detect whether a requested image is already loading.
  const imageLoadState = {};

  // Important: if image cache already has loaded images, mark these as loaded in imageLoadState!
  Object.keys(imageCache).forEach(imageUrl => {
    imageLoadState[imageUrl] = IMAGE_LOADED;
  });

  return (feature, mapResolution) => {
    // Determine resolution in meters/pixel.
    const resolution =
      typeof options.convertResolution === 'function'
        ? options.convertResolution(mapResolution)
        : mapResolution;

    // Determine applicable style rules for the feature, taking feature properties and current resolution into account.
    const rules = getRules(featureTypeStyle, feature, resolution, {
      getProperty: getOlFeatureProperty,
      getFeatureId: getOlFeatureId,
    });

    // Start loading images for external graphic symbolizers and when loaded:
    // * update symbolizers to use the cached image.
    // * call imageLoadedCallback with the image url.
    processExternalGraphicSymbolizers(
      rules,
      featureTypeStyle,
      imageLoadState,
      imageLoadedCallback
    );

    // Convert style rules to style rule lookup categorized by geometry type.
    const geometryStyles = getGeometryStyles(rules);

    // Determine style rule array.
    const olStyles = OlStyler(geometryStyles, feature);

    return olStyles;
  };
}
