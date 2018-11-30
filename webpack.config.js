const path = require('path');

module.exports = {
  // モード値を production に設定すると最適化された状態で、
  // development に設定するとソースマップ有効でJSファイルが出力される
  mode: 'development',

  // メインとなるJavaScriptファイル（エントリーポイント）
  entry: {
    "ot-es": './src/index.js'
  },

  output: {
    filename: '[name].js',
    library: 'ot-es',
    libraryTarget: 'umd',
    globalObject: 'typeof self !== \'undefined\' ? self : this',
    path: path.resolve(__dirname, 'dist')
  },

  module: {
    rules: [
      {
        // 拡張子 .js の場合
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            // Babel を利用する
            loader: 'babel-loader'
          }
        ]
      }
    ]
  },
  resolve: {
    modules: [
      path.resolve(__dirname, 'src'),
      'node_modules'
    ]
  }
};
