/*global __dirname describe it require*/
var ROOT = __dirname + '/../..', SRC = ROOT + '/src';
var expect = require('expect.js');
require(SRC + '/ebc.js');

describe('ebc', function() {
  xit('should fail', function() {
    expect(false).to.be(true);
  });
});
