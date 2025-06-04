//@ts-check
'use strict';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // VS Code extensions run in a Node.js-context
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📦
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    chunkFormat: 'module'
  },
  experiments: {
    outputModule: true
  },
  devtool: 'nosources-source-map',
  externals: {
    vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              compilerOptions: {
                "module": "esnext",
                "moduleResolution": "node"
              }
            }
          }
        ]
      }
    ]
  }
};

export default config;
