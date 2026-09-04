module.exports = function (api) {
  // api.env() must be called before api.cache() to be used as a cache key
  const isTest = api.env('test');
  api.cache.using(() => isTest);

  return {
    presets: [
      [
        'babel-preset-expo',
        // NativeWind jsxImportSource breaks jest-expo under Node 24 — skip in test
        isTest ? {} : { jsxImportSource: 'nativewind' },
      ],
    ],
    plugins: isTest ? [] : ['nativewind/babel'],
  };
};
