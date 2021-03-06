/*global require*/
// dependencies
var _ = require('./core.utils');
var array1d = _.array1d;
var check = _.check;
var isObject = check.object;
var isArray = check.array;
var array2d = _.array2d;
var fens = require('./fens');
var FeNodeSet = fens.FeNodeSet;
var gcells = require('./gcellset');
var P1 = gcells.P1;
var L2 = gcells.L2;
var Q4 = gcells.Q4;
var H8 = gcells.H8;

/**
 * @module mesh
 */

/**
 * @typedef module:mesh.MeshInitOption
 * @property {FeNodeSet} fens - optional. finite element node set.
 * @property {Array} xyz - optional. 2D array of node coordinates.
 * @property {GCellSet} gcells - optional. geometry cell set.
 * @property {String} gcellsType - optional. finite element node set.
 * @property {Array} conn - optional. connectiviy list.
 */

/**
 * Mesh class.
 * @class
 * @param {module:mesh.MeshInitOption} options
 * @example

   var msh1 = new Mesh({
     fens: new FeNodeSet(...),
     gcells: new L2(...)
   });

   var msh2 = new Mesh({
     xyz: [...],
     gcellsType: 'L2',
     conn: [...]
   });
 *
 */
exports.Mesh = function Mesh(options) {
  if (!isObject(options)) options = {};
  if (options.xyz) options.fens = new FeNodeSet({ xyz: options.xyz });
  this._fens = options.fens;
  this._gcells = options.gcells;
};
var Mesh = exports.Mesh;

/**
 * Returns finite element node set of the mesh.
 * @returns {module:fens.FeNodeSet}
 */
exports.Mesh.prototype.fens = function() { return this._fens; };

/**
 * Returns geometry cell set of the mesh.
 * @returns {module:gcellset.GCellSet}
 */
exports.Mesh.prototype.gcells = function() { return this._gcells; };

/**
 * @callback module:mesh.MapCallback
 * @param {module:types.Vector} coords
 * @param {Int} i
 * @returns {module:types.Vector}
 */

/**
 *
 * Apply the mapping function the each vertex, return the new mesh.
 * @param {module:mesh.MapCallback} mapping - the mapping function.
 * @returns {module:mesh.Mesh}
 */
exports.Mesh.prototype.map = function(mapping) {
  var fens = this._fens.map(mapping);
  return new Mesh({ fens: fens, gcells: this._gcells.clone() });
};


/**
 *
 * Return extruded mesh.
 * @param {Array} hList - A list of values for each extrude layer.
 * @param {Array} flags - Flags for each layer, falsy value means do
 * not create cells in this layer.
 * @returns {module:mesh.Mesh}
 */
exports.Mesh.prototype.extrude = function(hList, flags) {
  if (!isArray(hList) || !isArray(flags) || hList.length != flags.length)
    throw new Error('Mesh#extrude(hList, flags): hList and flags ' +
                   'must be array of same length.');

  var newFens = this._fens.extrude(hList);
  var newGcells = this._gcells.extrude(flags);
  return new Mesh({ fens: newFens, gcells: newGcells });
};

/**
 *
 * Return subdivied mesh.
 * @returns {module:mesh.Mesh} - subdivided mesh
 */
exports.Mesh.prototype.subdivide = function() {
  if (this._gcells.type() === 'Q4') return this.subdivideQ4();
  return this;
};

exports.Mesh.prototype.subdivideQ4 = function() {
  var fens = this._fens;
  var N = fens.count();
  var gcells = this._gcells;
  var topology = gcells.topology();

  var q4Cells = topology.getCellsInDim(2);
  var l2Cells = topology.getCellsInDim(1);

  var idx = N;
  var q4CellCenters = q4Cells.map(function(conn) {
    var n1 = fens.xyzAt(conn[0]);
    var n2 = fens.xyzAt(conn[1]);
    var n3 = fens.xyzAt(conn[2]);
    var n4 = fens.xyzAt(conn[3]);
    var x = 0.25 * (n1[0] + n2[0] + n3[0] + n4[0]);
    var y = 0.25 * (n1[1] + n2[1] + n3[1] + n4[1]);
    return { index: idx++, xy: [x, y] };
  });

  var hashEdge = function(n1, n2) {
    return '' + Math.min(n1, n2) + Math.max(n1, n2);
  };

  var l2CellCenters = l2Cells.map(function(conn) {
    var n1 = fens.xyzAt(conn[0]);
    var n2 = fens.xyzAt(conn[1]);
    var x = 0.5 * (n1[0] + n2[0]);
    var y = 0.5 * (n1[1] + n2[1]);
    return {
      key: hashEdge(conn[0], conn[1]),
      index: idx++,
      xy: [x, y]
    };
  });

  var addedFens = new FeNodeSet({
    xyz: q4CellCenters.map(function(p) {
      return p.xy;
    }).concat(l2CellCenters.map(function(p) {
      return p.xy;
    }))
  });

  var newFens = fens.combineWith(addedFens);
  var newConn = [];

  var l2CellCentersMap = l2CellCenters.reduce(function(sofar, obj) {
    sofar[obj.key] = obj;
    return sofar;
  }, {});

  q4Cells.forEach(function(cell, i) {
    var n1 = cell[0], n2 = cell[1];
    var n3 = cell[2], n4 = cell[3];
    var n12 = l2CellCentersMap[hashEdge(n1, n2)].index;
    var n23 = l2CellCentersMap[hashEdge(n2, n3)].index;
    var n34 = l2CellCentersMap[hashEdge(n3, n4)].index;
    var n41 = l2CellCentersMap[hashEdge(n4, n1)].index;
    var nCentroid = q4CellCenters[i].index;
    newConn.push([n1, n12, nCentroid, n41]);
    newConn.push([n41, nCentroid, n34, n4]);
    newConn.push([n12, n2, n23, nCentroid]);
    newConn.push([nCentroid, n23, n3, n34]);
  });

  var newGCellSet = new Q4({
    conn: newConn
  });

  return new Mesh({
    fens: newFens,
    gcells: newGCellSet
  });
};

/**
 * Creates a L-shaped domain using 3 quads.
 * @returns {module:mesh.Mesh}
 */
exports.L2x2 = function L2x2() {
  var fens, gcells;
  fens = new FeNodeSet({
    xyz: [
      [1/2, 0],
      [1, 0],
      [1, 1/2],
      [1/2, 1/2],
      [1, 1],
      [1/2, 1],
      [0, 1],
      [0, 1/2]
    ]
  });

  gcells = new Q4({
    conn: [
      [0, 1, 2, 3],
      [3, 2, 4, 5],
      [3, 5, 6, 7]
    ]
  });

  return new Mesh({ fens: fens, gcells: gcells });
};
var L2x2 = exports.L2x2;


/**
 * Creates a L2 block mesh.
 * @param {Number} w - width in x direction.
 * @param {Int} nx - number of divisions in x direction.
 * @returns {module:mesh.Mesh}
 */
exports.L2Block = function(w, nx) {
  var p0d = new Mesh({
    xyz: [ [] ],
    gcells: new P1({
      conn: [ [0] ]
    })
  });
  var hList = array1d(nx, w/nx);
  var flags = array1d(nx, true);
  return p0d.extrude(hList, flags);
};

/**
 * Creates a L2 block mesh.
 * @param {Number} w - width in x direction.
 * @param {Number} l - length in y direction.
 * @param {Int} nx - number of divisions in x direction.
 * @param {Int} ny - number of divisions in y direction.
 * @returns {module:mesh.Mesh}
 */
exports.Q4Block = function(w, l, nx, ny) {
  var l2 = exports.L2Block(w, nx);
  var hList = array1d(ny, l/ny);
  var flags = array1d(ny, true);
  return l2.extrude(hList, flags);
};

/**
 * Creates a H8 block mesh.
 * @param {Number} w - width in x direction.
 * @param {Number} l - length in y direction.
 * @param {Number} h - height in z direction.
 * @param {Int} nx - number of divisions in x direction.
 * @param {Int} ny - number of divisions in y direction.
 * @param {Int} nz - number of divisions in z direction.
 * @returns {module:mesh.Mesh}
 */
exports.H8Block = function(w, l, h, nx, ny, nz) {
  var q4 = exports.Q4Block(w, l, nx, ny);
  var hList = array1d(nz, h/nz);
  var flags = array1d(nz, true);
  return q4.extrude(hList, flags);
};
