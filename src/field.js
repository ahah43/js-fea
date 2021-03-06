/*global require*/
// field

var _ = require('./core.utils');
var cloneDeep = _.cloneDeep;
var check = _.check;
var assert = _.assert;
var isVectorOfDimension = check.isVectorOfDimension;
var array2d = _.array2d;
var array1d = _.array1d;
var defineContract = _.defineContract;
var matrixOfDimension = assert.ensureMatrixOfDimension;
var PointSet = require('./geometry.pointset').PointSet;
var FeNodeSet = require('./fens').FeNodeSet;

var _input_contract_field_option_ = defineContract(function(o) {
  assert.object(o);
  if (check.assigned(o.values)) {
    matrixOfDimension('*', '*', 'values is not a valid matrix.')(o.values);
  } else if (check.assigned(o.nfens) && check.assigned(o.dim)) {
    assert.integer(o.nfens);
    assert.integer(o.dim);
    if (o.nfens < 0) throw new Error('nfens must > 0.');
    if (o.dim < 0) throw new Error('dim must > 0');
  } else if (check.assigned(o.fens)) {
    assert.instance(o.fens, FeNodeSet);
  } else if (check.assigned(o.pointset)) {
    assert.instance(o.pointset, PointSet);
  } else {
    throw new Error('');
  }

  if (check.assigned(o.ebcs)) {
    assert.array(o.ebcs, 'ebcs must be a array of valid EBC object');
  }

}, 'Input is not a valid Field option.');

/**
 * @module field
 */

/**
 * Test
 * @param {Number} x
 * @returns {Number}
 */
function test() {}

/**
 * Field init option.
 * @typedef {Object} module:field.FieldInitOption
 * @property {Matrix|undefined} values
 * @property {PointSet|undefined} pointset
 * @property {FeNodeSet|undefined} fens
 * @property {Number|undefined} nfens
 * @property {Number|undefined} dim
 */

/**
 * Field
 * @class
 * @param {module:field.FieldInitOption}
 */
exports.Field = function Field(options) {
  _input_contract_field_option_(options);

  this._values = null;
  this._prescribed = null;
  this._prescribedValues = null;
  this._eqnums = null;
  this._neqns = -1;

  if (check.assigned(options.values)) {
    this._values = new PointSet(options.values);
  } else if (check.assigned(options.pointset)) {
    this._values = options.pointset.clone();
  } else if (check.assigned(options.fens)) {
    this._values = new PointSet(options.fens.xyz());
  } else if (check.assigned(options.nfens) && check.assigned(options.dim)) {
    this._values = new PointSet(options.nfens, options.dim);
  }

  if (check.assigned(options.ebcs)) {
    // TODO: merge ebcs
    var prescribed = array2d(this.nfens(), this.dim(), false);
    var prescribedValues =  array2d(this.nfens(), this.dim(), 0);
    this._prescribed = prescribed;
    this._prescribedValues = prescribedValues;

    options.ebcs.forEach(function(ebc) {
      // TODO: make sure ebc object is valid;
      ebc.applyToField_(this);
    }, this);
  }

};
var Field = exports.Field;

/**
 * Returns number of nodes in the field.
 * @returns {}
 */
exports.Field.prototype.nfens = function() {
  return this._values.getSize();
};

/**
 * Returns number of equations
 * @returns {Number}
 */
exports.Field.prototype.neqns = function() {
  if (!this._eqnums) this._numberEqnums_();
  return this._neqns;
};


/**
 * Returns dimension of the field.
 * @returns {Number}
 */
exports.Field.prototype.dim = function() {
  return this._values.getRn();
};

/**
 * Returns the values as 2d js array.
 * @returns {Array}
 */
exports.Field.prototype.values = function() {
  return this._values.toList();
};


/**
 * @callback Field~mapCallback
 * @param {Array} vec - the vector value at node.
 * @param {Number} i - index of the node.
 * @returns {Array} transformed vector value.
 */

/**
 * Returns a new transformed field by given mapping. No boudary
 * conditions are preserved.
 * @param {Field~mapCallback} fn - The mapping function that maps a
 * vector to another vector.
 * @returns {Field}
 */
exports.Field.prototype.map = function(fn) {
  var newPointset = this._values.map(fn);
  var newField = new Field({ pointset: newPointset });
  return newField;
};

/**
 * Returns an identical copy, preserves boundary conditions.
 * @returns {Feild}
 */
exports.Field.prototype.clone = function() {
  var newPointset = this._values.clone();
  var newField = new Field({ pointset: newPointset });
  newField._neqns = this._neqns;
  newField._eqnums = cloneDeep(this._eqnums);
  newField._prescribed = cloneDeep(this._prescribed);
  newField._prescribedValues = cloneDeep(this._prescribedValues);
  return newField;
};

/**
 * @callback Field~bopFn
 * @param {Array} vec - the vector value at node.
 * @param {Number} i - index of the node.
 * @returns {Array} transformed vector value.
 */

/**
 * Returns a new field that holds the result of binary operation.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @param {Field~bopFn} bopFn - binary operation function.
 * @param {String} bopName - binary operation name, which will make
 * better error message.
 * @returns {Field} Result field.
 */
exports.Field.prototype._bop = function(other, bopFn, bopName) {
  if (check.number(other)) {
    return this.map(function(vec) {
      return vec.map(function(x) {
        return bopFn(x, other);
      });
    });
  } else if (check.instance(other, Field) &&
             other.dim() === this.dim() &&
             other.nfens() === this.nfens()) {
    return this.map(function(vec, i) {
      return vec.map(function(x, j) {
        return bopFn(x, other.at(i)[j]);
      });
    });
  } else if (check.array(other) && other.length === this.dim()) {
    return this.map(function(vec) {
      return vec.map(function(x, j) {
        return bopFn(x, other[j]);
      });
    });
  } else
    throw new Error('Field::' + bopName +
                    '(other, bopFn): other must be a number' +
                    ' , a field of same this.nfens() and this.dim() or' +
                    ' an array of length this.dim().');
};

/**
 * Returns a new field that holds the result of binary operation.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @param {Field~bopFn} bopFn - binary operation function.
 * @returns {Field} Result field.
 */
exports.Field.prototype.bop = function(other, bopFn) {
  return this._bop(other, bopFn, bopFn.name || 'custom binary function');
};

/**
 * Returns a new field of the point-wise multiplication. No boudary
 * conditions are preserved.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @returns {Field} - muliplication of this and other.
 */
exports.Field.prototype.mul = function(other) {
  return this._bop(other, function(a,b) { return a * b; }, 'mul');
};
exports.Field.prototype.scale = exports.Field.prototype.mul;

/**
 * Returns a new field of the point-wise sumation. No boudary
 * conditions are preserved.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @returns {Field} - Sum of this and other.
 */
exports.Field.prototype.add = function(other) {
  return this._bop(other, function(a,b) { return a + b; }, 'add');
};

/**
 * Returns a new field of the point-wise substraction. No boudary
 * conditions are preserved.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @returns {Field} - substraction of this and other.
 */
exports.Field.prototype.sub = function(other) {
  return this._bop(other, function(a,b) { return a - b; }, 'sub');
};

/**
 * Returns a new field of the point-wise division. No boudary
 * conditions are preserved.
 * @param {Number|Field|Array} other - A number, a field of same nfens
 and dim or an array of length this.dim().
 * @returns {Field} - division of this and other.
 */
exports.Field.prototype.div = function(other) {
  return this._bop(other, function(a,b) { return a / b; }, 'div');
};

/**
 * Get value at index.
 * @param {Number} idx - index, 0-based
 * @return {Vector:this.dim()}
 */
exports.Field.prototype.at = function(idx) {
  return this._values.get(idx);
};

/**
 * Returns pointset object for visualization.
 * @returns {PointSet}
 */
exports.Field.prototype.pointset = function() {
  return this._values;
};

/**
 * Returns whether node at given direction is prescribed.
 * @param {Number} index - integer index of the node, 0-based.
 * @param {Number} direction - dimension index, 0-based.
 * @returns {Boolean}
 */
exports.Field.prototype.isPrescribed = function(index, direction) {
  if (!this._prescribed) return false;
  return this._prescribed[index][direction];
};

/**
 * Returns prescribed value of the node at given direction. Return 0
 * if the dof is not prescribed.
 * @param {Number} index - integer index of the node, 0-based.
 * @param {Number} direction - dimension index, 0-based.
 * @returns {Number}
 */
exports.Field.prototype.prescribedValue = function(index, direction) {
  if (this.isPrescribed(index, direction))
    return this._prescribedValues[index][direction];
  return 0;
};

/**
 * Set prescribed value of the node at given direction.
 * if the dof is not prescribed.
 * @param {Number} index - integer index of the node, 0-based.
 * @param {Number} dir - dimension index. 0-based.
 * @param {Number} val - value.
 */
exports.Field.prototype.setPrescribedValue_ = function(index, dir, val) {
  // console.log("val = ", val);
  // console.log("dir = ", dir);
  // console.log("id = ", id);
  // console.log("this._prescribed = ", this._prescribed);
  this._prescribed[index][dir] = true;
  this._prescribedValues[index][dir] = val;
  this._values.setAtDir_(index, dir, val);
};

exports.Field.INVALID_EQUATION_NUM = -1;

exports.Field.prototype._numberEqnums_ = function() {
  var eqnums = array2d(this.nfens(), this.dim(), exports.Field.INVALID_EQUATION_NUM);

  var count = 0, nfens = this.nfens(), dim = this.dim();
  var i, j;
  for (i = 0; i < nfens; ++i) {
    for (j = 0; j < dim; ++j) {
      if (!this.isPrescribed(i, j)) {
        eqnums[i][j] = count++;
      }
    }
  }
  this._eqnums = eqnums;
  this._neqns = count;
};

/**
 * Returns the eqnum number at node with given direction.
 * @param {Number} index - integer index of the node, 0-based.
 * @param {Number} direction - dimension index, 0-based.
 * @returns {Number} - equation number, 0-based.
 */
exports.Field.prototype.eqnum = function(index, direction) {
  if (!this._eqnums) this._numberEqnums_();
  if (index < 0 || index >= this.nfens()) throw new Error('Field::eqnum(): index out of range.');
  if (direction < 0 || direction >= this.dim()) throw new Error('Field::eqnum(): direction out of range.');
  return this._eqnums[index][direction];
};

/**
 * Returns gathered eqnum numbers in an js array.
 * @param {Array} conn - connectiviy vector.
 * @returns {Array} - an array of equation numbers of length
 * this.dim()*conn.length.
 */
exports.Field.prototype.gatherEqnumsVector = function(conn) {
  var vec = [], dim = this.dim();
  conn.forEach(function(fenid) {
    var i, eqnum;
    for (i = 0; i < dim; ++i) {
      vec.push(this.eqnum(fenid, i));
    }
  }, this);
  return vec;
};

/**
 * Returns gathered values in an 2d js array.
 * @param {Array} conn - connectiviy vector.
 * @returns {Array} - a 2d js array of values of dimension conn.length
 * by this.dim().
 */
exports.Field.prototype.gatherValuesMatrix = function(conn) {
  var len = conn.length, dim = this.dim();
  var mat = array1d(len, null);
  conn.forEach(function(idx, i) {
    mat[i] = this._values.get(idx);
  }, this);
  return mat;
};

/**
 * Returns gathered values in an 2d js array.
 * @param {Array} conn - connectiviy vector.
 * @returns {Array} - a 2d js array of values of dimension conn.length
 * by this.dim().
 */
exports.Field.prototype.gatherPrescirbedValues = function(conn) {
  var vec = [], dim = this.dim();
  conn.forEach(function(idx) {
    var dir;
    for (dir = 0; dir < dim; ++dir) {
      vec.push(this.prescribedValue(idx, dir));
    }
  }, this);
  return vec;
};

/**
 * Scatter values to field. Returns updated field.
 * @param {Array} vec - js array of length this.neqns();
 * @returns {Field} - updated field.
 */
exports.Field.prototype.scatterSystemVector_ = function(vec) {
  var neqns = this.neqns();
  if (!isVectorOfDimension(vec, neqns))
    throw new Error('Field::scatterSystemVector(): vec is not a vector of ' +
                    'dimension ' + neqns);

  if (!this._eqnums) this._numberEqnums_();

  var eqnums = this._eqnums;
  var nfens = this.nfens();
  var dim = this.dim();
  var values = this._values;
  var i, j, en, val;

  for (i = 0; i < nfens; ++i) {
    for (j = 0; j < dim; ++j) {
      en = eqnums[i][j];
      if (en !== exports.Field.INVALID_EQUATION_NUM) {
        val = vec[en];
        values.setAtDir_(i, j, val);
      }
    }
  }
};

exports.Field = Field;
