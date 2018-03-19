'use strict';

// plugins
const CleanPlugin = require('clean-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const CopyGlobsPlugin = require('copy-globs-webpack-plugin');
const FriendlyErrorsWebpackPlugin = require('friendly-errors-webpack-plugin');
const { default: ImageminPlugin } = require('imagemin-webpack-plugin');
const BrowserSyncPlugin = require('browsersync-webpack-plugin');
const WebpackAssetsManifestPlugin = require('webpack-assets-manifest');

// other required modules
const path = require('path');
const webpack = require('webpack');
const { argv } = require('yargs');
const imageminMozjpeg = require('imagemin-mozjpeg');
const url = require('url');


// config
const userConfig = require(`${__dirname}/../config`);
const rootPath = (userConfig.paths && userConfig.paths.root)
  ? userConfig.paths.root
  : process.cwd();
const assetsPath = path.join(rootPath, 'assets');
const entryPath = userConfig.entry;
const distPath = path.join(rootPath, 'dist');
const publicPath = userConfig.publicPath;
const devUrl = userConfig.devUrl;
const options = {
  isWatch: !!argv.watch, 
  isProduction: !!argv.p,
};
const assetsFilenames = options.isProduction ? '[name]_[hash:8]' : '[name]';

let webpackConfig = {
  context: assetsPath,
  devtool: '#source-map',
  entry: entryPath,
  output: {
    path: distPath,
    publicPath: publicPath,
    filename: `scripts/${assetsFilenames}.js`,
  },
  stats: {
    hash: true,
    version: false,
    timings: false,
    children: false,
    errors: false,
    errorDetails: false,
    warnings: true,
    chunks: false,
    modules: false,
    reasons: false,
    source: false,
    publicPath: false,
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.js$/,
        include: assetsPath,
        loader: 'eslint-loader',       
      },
      {
        enforce: 'pre',
        test: /\.(js|s?[ca]ss)$/,
        include: assetsPath,
        loader: 'import-glob-loader',
      },
      {
        test: /\.js$/,
        exclude: [/node_modules(?![/|\\](bootstrap|foundation-sites))/],
        use: [
          { loader: 'cache-loader' },
          { loader: 'buble-loader', options: { objectAssign: 'Object.assign' } },
        ],
      },
      {
        test: /\.css$/,
        include: assetsPath,
        use: ExtractTextPlugin.extract({
          fallback: 'style',
          use: [
            { 
              loader: 'cache-loader',
            },
            {
              loader: "css-loader", // translates CSS into CommonJS 
              options: {
                sourceMap: true,
                importLoaders: 1,
              },
            }, 
            {
              loader: 'postcss-loader', 
              options: {
                config: { path: __dirname, ctx: options},
                sourceMap: true,             
              },
            },
          ],
        }),
      },
      {
        test: /\.scss$/,
        include: assetsPath,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [ 
            { 
              loader: 'cache-loader',
            },
            {
              loader: "css-loader", // translates CSS into CommonJS 
              options: {
                sourceMap: true,
                importLoaders: 1,
              },
            }, 
            {
              loader: 'postcss-loader', 
              options: {
                config: { path: __dirname, ctx: options},
                sourceMap: true,             
              },
            },
            { loader: 'resolve-url-loader', options: { sourceMap: true } },          
            {
              loader: "sass-loader", // compiles Sass to CSS 
              options: {
                sourceMap: true,
              },
            },         
          ],
        }),
      },
      {
        test: /\.(ttf|eot|woff2?|png|jpe?g|gif|svg|ico)$/,
        include: assetsPath,
        loader: 'url-loader',
        options: {
          limit: 4096,
          name: `[path]${assetsFilenames}.[ext]`,
        },
      },      
      {
        test: /\.(ttf|eot|woff2?|png|jpe?g|gif|svg|ico)$/,
        include: /node_modules/,
        loader: 'url-loader',
        options: {
          limit: 4096,
          outputPath: 'vendor/',
          name: `[name]_[hash:8].[ext]`,
        },
      },             
    ],
  },
  resolve: {
    modules: [
      assetsPath,
      'node_modules',
    ],
    enforceExtension: false,
  },
  plugins: [
    new CleanPlugin([distPath], {
      root: rootPath,
      verbose: false,
    }),
    new CopyGlobsPlugin({
      pattern: 'images/**/*',
      output: `[path]${assetsFilenames}.[ext]`,
      manifest: {},
    }),
    new ExtractTextPlugin({
      filename: `styles/${assetsFilenames}.css`,
      allChunks: true,
      disable: options.isWatch,
    }),    
    new StyleLintPlugin({
      failOnError: false,
      syntax: 'scss',
    }),
    new FriendlyErrorsWebpackPlugin(),       
  ],
};

if (options.isProduction) {
  webpackConfig.plugins.push(
    new ImageminPlugin({
      optipng: { optimizationLevel: 7 },
      gifsicle: { optimizationLevel: 3 },
      pngquant: { quality: '65-90', speed: 4 },
      svgo: { removeUnknownsAndDefaults: false, cleanupIDs: false },
      plugins: [imageminMozjpeg({ quality: 75 })],
      disable: false,
    }),
  );

  webpackConfig.plugins.push(
    new webpack.NoEmitOnErrorsPlugin()
  );

  webpackConfig.plugins.push(
    new WebpackAssetsManifestPlugin({
      output: 'assets.json',
      space: 2,
      writeToDisk: false,
    })
  );  
}

if (options.isWatch) {
  let target = devUrl;

  webpackConfig.plugins.push(
    new webpack.optimize.OccurrenceOrderPlugin(),
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new BrowserSyncPlugin({
      target,
      proxyUrl: userConfig.proxyUrl,
      watch: userConfig.watch,
      delay: 500,
    }),    
  );

  /**
   * We do this to enable injection over SSL.
   */
  if (url.parse(target).protocol === 'https:') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
  }

  webpackConfig.stats = false;
  webpackConfig.devtool = '#cheap-module-source-map';
  webpackConfig.output.pathinfo = true;
  webpackConfig.output.publicPath = userConfig.proxyUrl + publicPath;
  webpackConfig.entry = require('./util/addHotMiddleware')(entryPath);
}

module.exports = webpackConfig;