/* global describe it expect before */
import Style from 'ol/style/Style';
import OLFormatGeoJSON from 'ol/format/GeoJSON';

import Reader from '../src/Reader';
import OlStyler, { createOlStyleFunction } from '../src/OlStyler';

import { sld } from './data/test.sld';

const getFeature = type => ({
  properties: {},
  geometry: {
    type,
  },
});

describe('Create style with multiple layers of the same type', () => {
    let sldObject;
    let featureTypeStyle;
    before(() => {
      sldObject = Reader(sld);
      [featureTypeStyle] = sldObject.layers[1].styles[0].featuretypestyles;
    });
  
    const geojson = {
      type: 'Feature',
      road_type: 'primary',
      geometry: {
        type: 'LineString',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    };
  
    const expecting = [{
      color: 'white',
      width: '3'
    }, {
      color: 'red',
      width: '2'
    }];
  
    it('roads layer style has 2 linesymbolizers', () => {
      const fmtGeoJSON = new OLFormatGeoJSON();
      const olFeature = fmtGeoJSON.readFeature(geojson);
      const styleFunction = createOlStyleFunction(featureTypeStyle);
      const featureStyles = styleFunction(olFeature, null);
      expect(featureStyles.length).to.equal(expecting.length);
      expecting.forEach((exp, i) => {
        expect(featureStyles[i].getStroke().getColor()).to.equal(exp.color);
        expect(featureStyles[i].getStroke().getWidth()).to.equal(exp.width);
      })
    });
  });