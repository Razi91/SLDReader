/* global describe it expect before */
import Reader from '../src/Reader';
import { sld } from './data/test.sld';
import { sld11 } from './data/test11.sld';

let result;

describe('Reads xml', () => {
  before(() => {
    result = Reader(sld);
  });
  it('returns object', () => {
    expect(result).to.be.an.instanceof(Object);
    expect(result.version).to.equal('1.0.0');
    expect(result.layers).to.be.an.instanceof(Array);
  });
  it('returns object for the layers', () => {
    const layernames = ['WaterBodies', 'Roads', 'Cities', 'Land'];
    expect(result.layers).to.have.length(4);
    for (let i = 0; i < result.layers.length; i += 1) {
      expect(result.layers[i].name).to.equal(layernames[i]);
    }
  });
  it('has style for waterbodies', () => {
    const wbstyles = result.layers['0'].styles;
    expect(wbstyles).to.be.an.instanceof(Array);
    expect(wbstyles).to.have.length(12);
  });
  it('style has props', () => {
    const style = result.layers['0'].styles['0'];
    expect(style.featuretypestyles).to.be.an.instanceof(Array);
    expect(style.default).to.be.true;
  });
  it('featuretypestyles has rules', () => {
    const featuretypestyle = result.layers['0'].styles['0'].featuretypestyles['0'];
    expect(featuretypestyle.rules).to.be.an.instanceof(Array);
  });
  it('rules have props', () => {
    const rule = result.layers['0'].styles['0'].featuretypestyles['0'].rules['0'];
    expect(rule.maxscaledenominator).to.equal('3000000');
    expect(rule.polygonsymbolizer).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill.css).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill.css.fill).to.equal('blue');
    expect(rule.polygonsymbolizer.fill.css.fillOpacity).to.equal('1.0');
    expect(rule.polygonsymbolizer.stroke.css.stroke).to.equal('#C0C0C0');
  });
  it('cities layer has PointSymbolizer with external graphic', () => {
    const rule = result.layers['2'].styles['0'].featuretypestyles['0'].rules['0'];
    expect(rule).to.have.property('pointsymbolizer');
    expect(rule.pointsymbolizer).to.have.property('graphic');
    expect(rule.pointsymbolizer.graphic).to.have.property('externalgraphic');
    expect(rule.pointsymbolizer.graphic.externalgraphic).to.have.property('onlineresource');
    expect(rule.pointsymbolizer.graphic.externalgraphic.onlineresource).to.equal(
      '../img/marker.png'
    );
  });
  it('cities layer has pointsymbolizer with graphic mark', () => {
    const rule = result.layers['2'].styles['0'].featuretypestyles['0'].rules['1'];
    expect(rule).to.have.property('pointsymbolizer');
    expect(rule.pointsymbolizer).to.have.property('graphic');
    expect(rule.pointsymbolizer.graphic).to.have.property('mark');
    expect(rule.pointsymbolizer.graphic).to.have.property('size');
    expect(rule.pointsymbolizer.graphic.mark).to.have.property('wellknownname');
    expect(rule.pointsymbolizer.graphic.mark.wellknownname).to.equal('cross');
  });

  describe('Filter tests', () => {
    it('rules have filter for featureid', () => {
      const { filter } = result.layers['0'].styles['0'].featuretypestyles['0'].rules['0'];
      expect(filter.type).to.equal('featureid');
      expect(filter.fids).to.be.an.instanceof(Array);
      expect(filter.fids).to.have.length(2);
      expect(filter.fids[0]).to.equal('tasmania_water_bodies.2');
    });

    it('rules have filter for Attribute Filter Styler PropertyIsEqualTo', () => {
      const { filter } = result.layers['0'].styles['2'].featuretypestyles['0'].rules['0'];
      expect(filter.type).to.equal('comparison');
      expect(filter.operator).to.equal('propertyisequalto');
      expect(filter.propertyname).to.equal('name');
      expect(filter.literal).to.equal('My simple Polygon');
    });

    it('NOT filter', () => {
      const notFilter = `<Filter>
        <Not>
          <PropertyIsEqualTo>
            <PropertyName>PERIMETER</PropertyName>
            <Literal>1071304933</Literal>
          </PropertyIsEqualTo>
        </Not>
      </Filter>`;
      const parsed = Reader(notFilter);
      expect(parsed.type).to.equal('not');
      expect(parsed.predicate).to.be.ok;
      expect(parsed.predicate.type).to.equal('comparison');
      expect(parsed.predicate.operator).to.equal('propertyisequalto');
      expect(parsed.predicate.propertyname).to.equal('PERIMETER');
      expect(parsed.predicate.literal).to.equal('1071304933');
    });

    it('rules have filter for Hover Styler not_or', () => {
      const { filter } = result.layers['0'].styles['1'].featuretypestyles['0'].rules['0'];

      /*
      <ogc:Not>
        <ogc:Or>
          <ogc:PropertyIsEqualTo>
            <ogc:PropertyName>PERIMETER</ogc:PropertyName>
            <ogc:Literal>1071304933</ogc:Literal>
          </ogc:PropertyIsEqualTo>
          <ogc:PropertyIsLessThan>
            <ogc:PropertyName>AREA</ogc:PropertyName>
            <ogc:Literal>1065512599</ogc:Literal>
          </ogc:PropertyIsLessThan>
        </ogc:Or>
      </ogc:Not>
      */

      expect(filter.type).to.equal('not');

      const predicate = filter.predicate;
      expect(predicate.type).to.equal('or');

      const orPredicate1 = predicate.predicates[0];
      expect(orPredicate1.type).to.equal('comparison');
      expect(orPredicate1.operator).to.equal('propertyisequalto');
      expect(orPredicate1.propertyname).to.equal('PERIMETER');
      expect(orPredicate1.literal).to.equal('1071304933');

      const orPredicate2 = predicate.predicates[1];
      expect(orPredicate2.type).to.equal('comparison');
      expect(orPredicate2.operator).to.equal('propertyislessthan');
      expect(orPredicate2.propertyname).to.equal('AREA');
      expect(orPredicate2.literal).to.equal('1065512599');
    });
  });
});

describe('Reads xml sld 11', () => {
  before(() => {
    result = Reader(sld11);
  });
  it('returns object', () => {
    expect(result).to.be.an.instanceof(Object);
    expect(result.version).to.equal('1.1.0');
    expect(result.layers).to.be.an.instanceof(Array);
  });
  it('returns object for the layers', () => {
    expect(result.layers).to.have.length(1);
    expect(result.layers['0'].name).to.equal('bestuurlijkegrenzen:provincies');
  });
  it('has styles', () => {
    const styles = result.layers['0'].styles;
    expect(styles).to.be.an.instanceof(Array);
    expect(styles).to.have.length(1);
  });
  it('style has props', () => {
    const style = result.layers['0'].styles['0'];
    expect(style.featuretypestyles).to.be.an.instanceof(Array);
  });
  it('featuretypestyles has rules', () => {
    const featuretypestyle = result.layers['0'].styles['0'].featuretypestyles['0'];
    expect(featuretypestyle.rules).to.be.an.instanceof(Array);
    expect(featuretypestyle.rules).to.have.length(13);
  });
  it('rules have svg props', () => {
    const rule = result.layers['0'].styles['0'].featuretypestyles['0'].rules['0'];
    expect(rule.polygonsymbolizer).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill.svg).to.be.an.instanceof(Object);
    expect(rule.polygonsymbolizer.fill.svg.fill).to.equal('#3544ea');
  });
});
