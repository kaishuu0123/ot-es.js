const { defaults } = require('jest-config');
const babelJest = require('babel-jest');

module.exports = {
  verbose: false,
  testRegex: "/test/jests/.+\\.(test|spec)\\.jsx?$",
  moduleDirectories: [
    "src",
    "node_modules"
  ],
  transform: {
    '^.+\\.js$': 'babel-jest'
  }
}
