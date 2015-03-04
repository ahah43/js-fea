var _ = require('./core.utils');

_.assign(exports, require('./core.bimap.js'));
_.assign(exports, require('./core.bipartite.js'));
_.assign(exports, require('./core.setstore.js'));
_.assign(exports, require('./femodel.js'));

exports._ = _;
exports.numeric = require('./core.numeric.js');
_.assign(exports.numeric, require('./core.numeric.integrationrule.js'));

exports.property = require('./property.js');
exports.material = require('./material.js');
exports.geometry = {
  pointset: require('./geometry.pointset'),
  topology: require('./geometry.topology')
};

exports.gcellset = require('./gcellset.js');
exports.field = require('./field.js');
exports.fens = require('./fens.js');
exports.feblock = require('./feblock.js');
exports.assemble = require('./core.assemble.js');
