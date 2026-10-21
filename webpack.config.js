// Adapted from the Sierra Pilots Importer's webpack config (itself from the RemNote plugin template),
// without Tailwind/PostCSS: the widgets use plain CSS with RemNote's theme variables.
const { resolve } = require('path');
const glob = require('glob');
const path = require('path');

const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const { ProvidePlugin, BannerPlugin } = require('webpack');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const isProd = process.env.NODE_ENV === 'production';
const SANDBOX_SUFFIX = '-sandbox';

const config = {
  mode: isProd ? 'production' : 'development',
  entry: glob.sync('./src/widgets/**.tsx').reduce((obj, el) => {
    obj[path.parse(el).name] = el;
    obj[path.parse(el).name + SANDBOX_SUFFIX] = el;
    return obj;
  }, {}),
  output: {
    path: resolve(__dirname, 'dist'),
    filename: `[name].js`,
    publicPath: '',
  },
  resolve: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
  module: {
    rules: [
      {
        test: /\.(ts|tsx|jsx|js)?$/,
        loader: 'esbuild-loader',
        options: { loader: 'tsx', target: 'es2020', minify: false },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', { loader: 'css-loader', options: { url: false } }],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      templateContent: `
      <body></body>
      <script type="text/javascript">
      const urlSearchParams = new URLSearchParams(window.location.search);
      const queryParams = Object.fromEntries(urlSearchParams.entries());
      const widgetName = queryParams["widgetName"];
      if (widgetName == undefined) {document.body.innerHTML+="Widget ID not specified."}

      const s = document.createElement('script');
      s.type = "module";
      s.src = widgetName+"${SANDBOX_SUFFIX}.js";
      document.body.appendChild(s);
      </script>
    `,
      filename: 'index.html',
      inject: false,
    }),
    new ProvidePlugin({ React: 'react', reactDOM: 'react-dom' }),
    new BannerPlugin({
      banner: (file) => (!file.chunk?.name?.includes(SANDBOX_SUFFIX) ? 'const IMPORT_META=import.meta;' : ''),
      raw: true,
    }),
    // Through webpack rather than the build script, so the dev server serves them too:
    // RemNote's plugin page fetches README.md, and every window requests snippet.css.
    new CopyPlugin({ patterns: [{ from: 'public', to: '' }, { from: 'README.md', to: '' }] }),
    !isProd && new ReactRefreshWebpackPlugin(),
  ].filter(Boolean),
};

if (isProd) {
  config.optimization = { minimize: true, minimizer: [new ESBuildMinifyPlugin()] };
} else {
  config.devServer = {
    port: 8082, // 8080: Incremental RemNote, 8081: Sierra Pilots Importer
    hot: true,
    compress: true,
    watchFiles: ['src/*'],
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'X-Requested-With, content-type, Authorization',
    },
  };
}

module.exports = config;
