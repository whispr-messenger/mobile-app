module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert'
      ]
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 72]
  },
  parserPreset: {
    parserOpts: {
      headerPattern: /^(\u00a9|\ufe0f|\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f]|\ud83d[\ude80-\udeff]|\ud83e[\udd10-\uddff]|\u2600-\u27bf|\ud83c[\udde6-\uddff]{2}|\ud83d[\udc68-\udc69]\ud83c[\udffb-\udfff]?) (\w+)(\([\w-]+\))?: (.+)$/,
      headerCorrespondence: ['emoji', 'type', 'scope', 'subject']
    }
  }
};

