/*global require*/
// Dependenices
var _ = require('./core.utils');
var uuid = _.uuid;
var noop = _.noop;
var defineContract = _.defineContract;
var assert = _.assert;
var check = _.check;
var isAssigned = check.assigned;
var isObject = check.object;
var isa = check.instance;
var isNumber = check.number;
var isFunction = check.function;
var matrixOfDimension = assert.matrixOfDimension;
var vectorOfDimension = assert.vectorOfDimension;

var numeric = require('./core.numeric');
var size = numeric.size;
var norm = numeric.norm;
var nthColumn = numeric.nthColumn;
var dot = numeric.dot;
var mul = numeric.mul;
var inv = numeric.inv;
var transpose = numeric.transpose;

var feutils = require('./feutils');
var skewmat = feutils.skewmat;

var topology = require('./geometry.topology');
var Topology = topology.Topology;
var hypercube = topology.hypercube;

// typedefs
/**
 * A 1D js array of numbers that has non-zero length.
 * @typedef GCellSet~Vector
 */

/**
 * A 2D js array of numbers that: 1) has non-zero number of rows.
 * (mat.length > 0). 2) has consistent non-zero column
 * length. (mat[0].length === mat[1].length ... === mat[m-1].length >
 * 0)
 * @typedef GCellSet~Matrix
 */

/**
 * An array of positive integers.
 * @typedef GCellSet~Connectivity
 */

/**
 * A {@link GCellSet~Matrix} of positive integers. Each row of the
 * matrix is a {@link GCellSet~Connectivity}.
 * @typedef GCellSet~ConnectivityList
 */

/**
 * @typedef GCellSet~InitOption
 * @property {Topology} topology - required.
 * @property {Number} otherDimension - optional. default is 1.0.
 * @property {Boolean} axisSymm - optional. default is false.
 */

/**
 * Geometry cell set.
 * @class
 * @param {Topology} topology
 */
// Supposed to be private
// TODO: support lookup by label.
// function GCellSet(topology) {
function GCellSet(options) {
  if (!isObject(options) || !isa(options.topology, Topology))
    throw new Error('GCellSet#constructor(options): options' +
                    ' is not a valid GCellSet~InitOption.');

  this._axisSymm = null;
  this._otherDimension = null;
  this._id = null;
  this._topology = null;

  if (isNumber(options.otherDimension) || isFunction(options.otherDimension)) {
    this._otherDimension = options.otherDimension;
  } else {
    this._otherDimension = 1.0;
  }

  if (isAssigned(options.axisSymm))
    this._axisSymm = !!(options.axisSymm);
  else
    this._axisSymm = false;

  var topology = options.topology;
  var cellSizeFromTopology = topology.getCellSizeInDim(topology.getDim());
  var cellSizeShouldBe = this.cellSize();
  if (cellSizeFromTopology !== cellSizeShouldBe)
    throw new Error('GCellSet(): cellSize of the topology dismatch.');

  var dimFromTopology = topology.getDim();
  var dimShouldBe = this.dim();
  if (dimFromTopology !== dimShouldBe)
    throw new Error('GCellSet(): dim of the topology dismatch.');

  this._id = uuid();
  this._topology = topology;
}
exports.GCellSet = GCellSet;

/**
 * Returns the full topology of gcellset. Mainly used for
 * visualization.
 * @returns {Topology}
 */
GCellSet.prototype.topology = function() {
  return this._topology;
};

/**
 * Evaluate the other dimension (area, thickness) of the element at
 * given parametric coordinates, or at any given spatial
 * coordinate.
 * @param {GCellSet~Connectivity} conn - connectivity of a single
 * cell.
 * @param {GCellSet~Matrix} N - values of the basic functions.
 * @param {GCellSet~Matrix} x - spatial coordinates.
 * @returns {Number}
 */
GCellSet.prototype.otherDimension = function(conn, N, x) {
  if (typeof this._otherDimension === 'function')
    return this._otherDimension(conn, N, x);
  return this._otherDimension;
};

/**
 * Returns whether it is axis symmetric.
 * @returns {Boolean}
 */
GCellSet.prototype.axisSymm = function() { return this._axisSymm; };

/**
 * Returns a vector of vertices ids. Mainly used for visualization.
 * @returns {GCellSet~Vector}
 */
GCellSet.prototype.vertices = function() {
  return this._topology.getPointIndices();
};

/**
 * Returns a list of L2 cells. Mainly used for visualization.
 * @returns {GCellSet~ConnectivityList}
 */
GCellSet.prototype.edges = function() {
  return this._topology.getCellsInDim(1);
};

/**
 * Returns a list of T3 cells. Mainly used for visualization.
 * @returns {GCellSet~ConnectivityList}
 */
GCellSet.prototype.triangles = function() {
  return this._topology.getCellsInDim(2);
};

/**
 * Returns a unique type string of this gcellset.
 * @abstract
 * @returns {String} the type string of this gcellset.
 */
GCellSet.prototype.type = function() {
  throw new Error('GCellSet::type(): is not implemented.');
};

/**
 * Returns the constructor of boundary gcellset. For example, Q4
 * should return L2 as its boundary cell constructor, while L2 should retrun P1.
 * @abstract
 * @returns {Function} the constructor of boundary gcellset.
 */
GCellSet.prototype.boundaryGCellSetConstructor = function() {
  throw new Error('GCellSet::getBoundaryGCellSetConstructor(): is not implemented.');
};

/**
 * Return the type of boundary gcellset.
 * @returns {String} type of boundary gcellset.
 */
GCellSet.prototype.boundaryCellType = function() {
  var C = this.boundaryGCellSetConstructor();
  return C.prototype.type.call(null);
};

/**
 * Return the boundary of this gcellset.
 * @returns {GCellSet} the boundary gcellset.
 */
GCellSet.prototype.boundary = function() {
  var C = this.boundaryGCellSetConstructor();
  var boundaryTopology = this._topology.boundary();
  return new C(boundaryTopology);
};

/**
 * Returns the dimension of this geometry cell set.
 * @abstract
 * @returns {Int} dimension.
 */
GCellSet.prototype.dim = function() {
  throw new Error('GCellSet::dim(): is not implemented.');
};

/**
 * Returns the cell size.
 * @abstract
 * @returns {Int} number of nodes per cell.
 */
GCellSet.prototype.cellSize = function() {
  throw new Error('GCellSet::cellSize(): is not implemented.');
};

/**
 * Returns the unique id of this geometry cell set.
 * @returns {String} unique id.
 */
GCellSet.prototype.id = function() {
  return this._id;
};

/**
 * Returns the connectiviy list.
 * @returns {GCellSet~ConnectivityList} connectivity list of length
 * this.count().
 */
GCellSet.prototype.conn = function() {
  return this._topology.getMaxCells();
};

/**
 * Returns the jacob matrix.
 * @param {GCellSet~Matrix} nder - Nodal derivatives in parametric domain.
 * @param {GCellSet~Matrix} x - Nodal coordinates in spatial domain.
 * @returns {GCellSet~Matrix} Jacob matrix.
 */
GCellSet.prototype.jacobianMatrix = function(nder, x) {
  return mul(transpose(x), nder);
};

/**
 * @abstract
 * @param {GCellSet~Matrix} paramCoords - Coordinates in parametric domain.
 * @returns {GCellSet~Matrix} Nodal contributions.
 */
GCellSet.prototype.bfun = function(paramCoords) {
  throw new Error('GCellSet::bfun(): is not implemented.');
};

/**
 * @abstract
 * @param {GCellSet~Matrix} paramCoords - Coordinates in parametric domain.
 * @returns {GCellSet~Matrix} Nodal contribution derivatives.
 */
GCellSet.prototype.bfundpar = function(paramCoords) {
  throw new Error('GCellSet::bfundpar(): is not implemented.');
};

// bfundsp :: GCellSet -> NodalDerivativesInParametricDomain -> NodalCoordinatesInSpatialDomain
//            -> NodalDerivativesInSpatialDomain
// NodalDerivativesInParametricDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// NodalDerivativesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// bfundsp: derivatives of the basis functions in spatical domain.
// var _input_contract_funct_bfundsp_ = function(m, n) {
//   return defineContract(function(nder, x) {
//     matrixOfDimension(
//       m,
//       n,
//       'NodalDerivativesInParametricDomain is not a matrix of ' + m + ' x ' + n
//     )(nder);

//     matrixOfDimension(
//       m,
//       n,
//       'NodalCoordinatesInSpatialDomain is not a matix of ' + m + ' x ' + n
//     )(x);
//   }, 'Input is invalid for bfundsp');
// };

// var _contract_funct_J_ = function(n) {
//   return defineContract(function(J) {
//     matrixOfDimension(n,n)(J);
//   },'J is not a matrix of ' + n + ' x ' + n);
// };

// var _output_contract_funct_bfundsp_ = function(m, n) {
//   return defineContract(function(mat) {
//     matrixOfDimension(m, n)(mat);
//   }, 'Output is invalid for bfunsp, it is not ' + m + ' by ' + n);
// };

/**
 * Returns derivatives of the basis functions in spatical domain.
 * @param {GCellSet~Matrix} nder - Nodal derivatives in parametric
 * domain.
 * @param {GCellSet~Matrix} x - Nodal coordinates in spatial domain.
 * @returns {GCellSet~Matrix} Derivatives of the basis functions in
 * spatical domain.
 */
GCellSet.prototype.bfundsp = function(nder, x) {
  var J = mul(transpose(x), nder);
  var res = dot(nder, inv(J));
  return res;
};

// TODO:
// GCellSet.prototype.cat = function() {
//   throw new Error('GCellSet::cat(): is not implemented.');
// };

/**
 * Return the number of cells.
 * @returns {Int}
 */
GCellSet.prototype.count = function() {
  return this._topology.getNumOfCellsInDim(this._topology.getDim());
};

/**
 * Return the number of nodes this gcellset connect
 * @returns {Int}
 */
GCellSet.prototype.nfens = function() {
  return this._topology.getNumOfCellsInDim(0);
};

// TODO:
// GCellSet.prototype.isInParametric = function(paramCoords) {
//   throw new Error('GCellSet::isInParametric(): is not implemented.');
// };

// TODO:
// GCellSet.prototype.map2parametric = function(x, c) {
//   throw new Error('GCellSet::map2parametric(): is not implemented.');
// };

// subset :: GCellSet -> Indices
//           -> GCellSet
// Indices :: [ Int ]
// subset: Return a new GCellSet which is a subset of self by given indices.
// index starts from zero
function subset(conn, indices) {
  var newConn = [];
  indices.forEach(function(idx) {
    return newConn.push(conn[idx]);
  });
  return newConn;
}
GCellSet.prototype.subset = function(indices) {
  throw new Error('GCellSet::subset(): is not implemented.');
};

GCellSet.prototype.clone = function() {
  throw new Error('GCellSet::clone(): is not implemented.');
};

// TODO:
// GCellSet.prototype.updateConnectivity = function() {
//   throw new Error('GCellSet::updateConnectivity(): is not implemented.');
// };

/**
 * Geometry cell set of mainfold 1.
 * @class
 * @extends GCellSet
 */
function Manifold1GCellSet(options) {
  GCellSet.call(this, options);
}

Manifold1GCellSet.prototype = Object.create(GCellSet.prototype);
Manifold1GCellSet.prototype.constructor = Manifold1GCellSet;

Manifold1GCellSet.prototype.dim = function() { return 1; };

// var _input_contract_m1_jac_ = _.defineContract(function(conn, N, J, x) {
//   // console.log("x = ", x);
//   // console.log("J = ", J);
//   // console.log("N = ", N);
//   // console.log("conn = ", conn);
//   return;
//   vectorOfDimension(2)(conn);
//   matrixOfDimension(2, '*')(N);
//   matrixOfDimension('*', 1)(J);
//   matrixOfDimension(2, 2)(x);
// }, 'input is not valid for mainfold 1 gcellset jacobian.');

// var _output_contract_jac_ = _.defineContract(function(jac) {
//   assert.number(jac);
// }, 'jac is not a number');

// jacobian :: GCellSet -> ConnectivityList -> NodalContributionVector -> JacobianMatrix
//             -> NodalCoordinatesInSpatialDomain
//             -> ManifoldJacobian
// ConnectivityList :: 1D JS array of dimension this.cellSize()
// NodalContributionVector :: 1D JS array of length this.cellSize()
// JacobianMatrix :: 2D JS array of dimension this.dim() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// ManifoldJacobian :: number
Manifold1GCellSet.prototype.jacobian = function(conn, N, J, x) {
  var jac = this.jacobianCurve(conn, N, J, x);
  return jac;
};

// jacobian :: GCellSet -> ConnectivityList -> NodalContributionVector -> JacobianMatrix
//             -> NodalCoordinatesInSpatialDomain
//             -> ManifoldJacobian
// ConnectivityList :: 1D JS array of dimension this.cellSize()
// NodalContributionVector :: 1D JS array of length this.cellSize()
// JacobianMatrix :: 2D JS array of dimension this.dim() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// ManifoldJacobian :: number
Manifold1GCellSet.prototype.jacobianCurve = function(conn, N, J, x) {
  var vec = transpose(J)[0];
  var jac = norm(vec);
  return jac;
};

// jacobian :: GCellSet -> ConnectivityList -> NodalContributionVector -> JacobianMatrix
//             -> NodalCoordinatesInSpatialDomain
//             -> ManifoldJacobian
// ConnectivityList :: 1D JS array of dimension this.cellSize()
// NodalContributionVector :: 1D JS array of length this.cellSize()
// JacobianMatrix :: 2D JS array of dimension this.dim() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// ManifoldJacobian :: number
// For the one-dimensional cell, the surface Jacobian is
//     (i) the product of the curve Jacobian and the other dimension
//     (units of length);
//     or, when used as axially symmetric
//     (ii) the product of the curve Jacobian and the circumference of
//     the circle through the point pc.
Manifold1GCellSet.prototype.jacobianSurface = function(conn, N, J, x) {
  var jac;
  if (this.axisSymm()) {
    var xyz = mul(transpose(N), x)[0];
    jac = this.jacobianCurve(conn, N, J, x) * 2 * Math.PI * xyz[0];
  } else {
    jac = this.jacobianCurve(conn, N, J, x) * this.otherDimension(conn, N, x);
  }
  return jac;
};

// jacobian :: GCellSet -> ConnectivityList -> NodalContributionVector -> JacobianMatrix
//             -> NodalCoordinatesInSpatialDomain
//             -> ManifoldJacobian
// ConnectivityList :: 1D JS array of dimension this.cellSize()
// NodalContributionVector :: 1D JS array of length this.cellSize()
// JacobianMatrix :: 2D JS array of dimension this.dim() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// ManifoldJacobian :: number
// For the one-dimensional cell, the volume Jacobian is
//     (i) the product of the curve Jacobian and the other dimension
//     (units of length squared);
//     or, when used as axially symmetric
//     (ii) the product of the curve Jacobian and the circumference of
//     the circle through the point pc and the other dimension (units of
//     length)
Manifold1GCellSet.prototype.jacobianVolumn = function(conn, N, J, x) {
  var jac;
  if (this.axisSymm()) {
    var xyz = mul(transpose(N), x)[0];
    jac = this.jacobianCurve(conn, N, J, x) * 2 * Math.PI * xyz[0] * this.otherDimension(conn, N, x);
  } else {
    jac = this.jacobianCurve(conn, N, J, x) * this.otherDimension(conn, N, x);
  }
  return jac;
};

// jacobian :: GCellSet -> ConnectivityList -> NodalContributionVector -> JacobianMatrix
//             -> NodalCoordinatesInSpatialDomain -> Dimension
//             -> ManifoldJacobian
// ConnectivityList :: 1D JS array of dimension this.cellSize()
// NodalContributionVector :: 1D JS array of length this.cellSize()
// JacobianMatrix :: 2D JS array of dimension this.dim() by this.dim()
// NodalCoordinatesInSpatialDomain :: 2D JS array of dimension this.cellSize() by this.dim()
// Dimension :: int
// ManifoldJacobian :: number
// jacobianInDim: A convinient wrapper for jacobianCurve, jacobianSurface, jacobianVolumn
Manifold1GCellSet.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  var jac;

  switch (dim) {
  case 3:
    jac = this.jacobianVolumn(conn, N, J, x);
    break;
  case 2:
    jac = this.jacobianSurface(conn, N, J, x);
    break;
  case 1:
    jac = this.jacobianCurve(conn, N, J, x);
    break;
  default:
    throw new Error('Manifold1GCellSet::jacobianInDim(): wrong dimension ' + dim);
  }
  return jac;
};

function Manifold2GCellSet(options) {
  GCellSet.call(this, options);
}
exports.Manifold2GCellSet = Manifold2GCellSet;
Manifold2GCellSet.prototype = Object.create(GCellSet.prototype);
Manifold2GCellSet.prototype.constructor = Manifold2GCellSet;

Manifold2GCellSet.prototype.dim = function() { return 2; };

Manifold2GCellSet.prototype.jacobian = function(conn, N, J, x) {
  return this.jacobianSurface(conn, N, J, x);
};

Manifold2GCellSet.prototype.jacobianInDim = function(conn, N, J, x, dim) {
  switch (dim) {
  case 3:
    return this.jacobianVolumn(conn, N, J, x);
  case 2:
    return this.jacobianSurface(conn, N, J, x);
  default:
    throw new Error('Manifold2GCellSet::jacobianInDim(): unsupported dim ' + dim);
  }
};

Manifold2GCellSet.prototype.jacobianSurface = function(conn, N, J, x) {
  var tmp = size(J), sdim = tmp[0], ntan = tmp[1];
  var jac;
  if (ntan === 2) {
    if (sdim === ntan) {
      jac = J[0][0]*J[1][1] - J[1][0]*J[0][1];
    } else {
      jac = skewmat(nthColumn(J, 1));
      jac = dot(jac, nthColumn(J, 2));
      jac = norm(jac);
    }
  } else {
    throw new Error('Manifold2GCellSet::jacobianSurface(): is not implemented when ntan is not 2');
  }
  return jac;
};

Manifold2GCellSet.prototype.jacobianVolumn = function(conn, N, J, x) {
  var xyz, jac;
  if (this.axisSymm()) {
    xyz = dot(transpose(N), x);
    jac = this.jacobianSurface(conn, N, J, x)*2*Math.PI*xyz[0];
  } else {
    jac = this.jacobianSurface(conn, N, J, x)*this.otherDimension(conn, N, x);
  }
  return jac;
};

var _input_contract_gcellset_ = defineContract(function(options) {
  assert.object(options);
  assert.assigned(options.conn);
  matrixOfDimension('*', '*')(options.conn);
}, 'input is not a valid gcellset option.');

var _input_contract_L2_ = defineContract(function(options) {
  _input_contract_gcellset_(options);

  matrixOfDimension('*', 2)(options.conn);
  if (check.assigned(options.otherDimension)) {
    assert.number(options.otherDimension);
  }

  if (check.assigned(options.axisSymm)) {
    assert.boolean(options.axisSymm);
  }
}, 'input is not a valid L2 option.');

function L2(options) {
  if (!options || !options.conn)
    throw new Error('L2#constructor(options): options is not a valid' +
                    ' L2~InitOption');

  var conn = options.conn;
  options.topology = hypercube(conn, 1);
  Manifold1GCellSet.call(this, options);
}

L2.prototype = Object.create(Manifold1GCellSet.prototype);
L2.prototype.constructor = L2;
L2.prototype.boundaryGCellSetConstructor = function() {
  // TODO:
  return P1;
};

L2.prototype.subset = function(indices) {
  var conn = subset(this.conn(), indices);
  return new L2({
    conn: conn,
    axisSymm: this.axisSymm(),
    otherDimension: this._otherDimension
  });
};

L2.prototype.triangles = function() { return []; };

L2.prototype.cellSize = function() { return 2; };

L2.prototype.type = function() { return 'L2'; };

var _input_contract_l2_param_coords_ = defineContract(function(paramCoords) {
  vectorOfDimension(1)(paramCoords);
}, 'input is not a valid l2 param coords, which should be of vector of dimension 1.');

L2.prototype.bfun = function(paramCoords) {
  _input_contract_l2_param_coords_(paramCoords);

  var x = paramCoords[0];
  var out = [
    [ 0.5 * (1 - x) ],
    [ 0.5 * (1 + x) ]
  ];
  return out;
};

L2.prototype.bfundpar = function(paramCoords) {
  _input_contract_l2_param_coords_(paramCoords);

  return [
    [ -0.5 ],
    [ +0.5 ]
  ];
};

exports.L2 = L2;

function Q4(options) {
  if (!options || !options.conn)
    throw new Error('Q4#constructor(options): options is not a valid' +
                    ' Q4~InitOption');

  var conn = options.conn;
  options.topology = hypercube(conn, 2);
  Manifold2GCellSet.call(this, options);
}
exports.Q4 = Q4;
Q4.prototype = Object.create(Manifold2GCellSet.prototype);
Q4.prototype.constructor = Q4;

Q4.prototype.subset = function(indices) {
  var conn = subset(this.conn(), indices);
  return new Q4({
    conn: conn,
    axisSymm: this.axisSymm(),
    otherDimension: this._otherDimension
  });
};

Q4.prototype.cellSize = function() { return 4; };

Q4.prototype.type = function() { return 'Q4'; };

Q4.prototype.boundaryGCellSetConstructor = function() { return L2; };

Q4.prototype.triangles = function() {
  var quads = this._topology.getCellsInDim(2);
  var triangles = [];

  quads.forEach(function(quad) {
    var t1 = [quad[0], quad[1], quad[2]];
    var t2 = [quad[2], quad[3], quad[0]];
    triangles.push(t1, t2);
  });

  return triangles;
};

// paramCoords: vec:2
// return: mat:4,1
Q4.prototype.bfun = function(paramCoords) {
  var one_minus_xi = (1 - paramCoords[0]);
  var one_plus_xi  = (1 + paramCoords[0]);
  var one_minus_eta = (1 - paramCoords[1]);
  var one_plus_eta  = (1 + paramCoords[1]);

  var val = [
    [0.25 * one_minus_xi * one_minus_eta],
    [0.25 * one_plus_xi  * one_minus_eta],
    [0.25 * one_plus_xi  * one_plus_eta],
    [0.25 * one_minus_xi * one_plus_eta]
  ];
  return val;
};

// paramCoords: vec:2
// return: mat:4,1
Q4.prototype.bfundpar = function(paramCoords) {
  var xi = paramCoords[0], eta = paramCoords[1];
  var val = [
    [-(1. - eta) * 0.25, -(1. - xi) * 0.25],
    [(1. - eta) * 0.25, -(1. + xi) * 0.25],
    [(1. + eta) * 0.25, (1. + xi) * 0.25],
    [-(1. + eta) * 0.25, (1. - xi) * 0.25]
  ];
  return val;
};
