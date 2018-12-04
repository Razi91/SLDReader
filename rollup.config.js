import buble from 'rollup-plugin-buble';

const resolve = require('rollup-plugin-node-resolve');

export default {
  input: 'src/index.js',
  external: moduleId => moduleId.indexOf('ol') === 0,
  output: {
    file: 'dist/sldreader.js',
    format: 'umd',
    name: 'SLDReader',
    globals: {
      'ol/style/Style': 'ol.style.Style',
      'ol/style/Fill': 'ol.style.Fill',
      'ol/style/Stroke': 'ol.style.Stroke',
      'ol/style/Circle': 'ol.style.Circle',
      'ol/style/Icon': 'ol.style.Icon',
      'ol/style/Text': 'ol.style.Text',
      'ol/style/RegularShape': 'ol.style.RegularShape',
    },
  },
  plugins: [buble(), resolve()],
};
