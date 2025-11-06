import { Configuration } from '@rspack/cli';
import { rspack } from '@rspack/core';
import path from 'path';

const config: Configuration = {
  entry: {
    main: './src/index.tsx'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              tsx: true
            },
            transform: {
              react: {
                runtime: 'automatic'
              }
            }
          }
        }
      },
      {
        test: /\.css$/i,
        use: [rspack.CssExtractRspackPlugin.loader, 'css-loader'],
        type: 'javascript/auto',
      },
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  plugins: [
    new rspack.CssExtractRspackPlugin({}),
    new rspack.HtmlRspackPlugin({
      template: './index.html'
    }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    hot: true
  }
};

export default config;