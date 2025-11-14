const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({ ...env }, argv);

  // Remove WebpackManifestPlugin to avoid incompatibility causing
  // "The 'compilation' argument must be an instance of Compilation"
  if (Array.isArray(config.plugins)) {
    config.plugins = config.plugins.filter(
      (plugin) => plugin?.constructor?.name !== 'WebpackManifestPlugin'
    );
  }

  return config;
};