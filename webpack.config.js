const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './modules/todoist.js',
  devtool: 'source-map',
  output: {
    filename: 'todoist.js',
    path: path.resolve(__dirname, 'dist'),
  },
  mode: 'production', // not exactly sure what defaults this sets but it gets rid of a warning
};
