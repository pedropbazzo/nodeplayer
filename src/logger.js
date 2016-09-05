'use strict';
let config = require('./config').getConfig();
let winston = require('winston');

module.exports = label => {
  return new (winston.Logger)({
    transports: [
      new (winston.transports.Console)({
        label: label,
        level: config.logLevel,
        colorize: config.logColorize,
        handleExceptions: config.logExceptions,
        json: config.logJson,
      }),
    ],
  });
};
