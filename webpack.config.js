const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: {
      main: './js/main.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'js/[name].[contenthash].bundle.js',
      clean: true,
      publicPath: '/',
    },
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpe?g|gif|svg|woff2?|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[hash][ext][query]'
          }
        }
      ]
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        chunks: ['main']
      }),
      new CopyWebpackPlugin({
        patterns: [
          { 
            from: '**/*',
            to: '.',
            globOptions: {
              ignore: [
                '**/node_modules/**',
                '**/package*.json',
                '**/webpack.config.js',
                '**/update-html-scripts.js',
                '**/dist/**',
                '**/src/**',
                '**/js/modules/**',
                '**/js/main.js',
                '**/.git/**',
                '**/.vscode/**',
                '**/*.md'
              ]
            }
          }
        ]
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist'),
      },
      compress: true,
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true,
    },
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
        },
      },
      runtimeChunk: 'single',
    },
  };
};
