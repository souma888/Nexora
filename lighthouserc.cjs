module.exports = {
  ci: {
    collect: {
      staticDistDir: 'dist',
      url: ['http://localhost/', 'http://localhost/simulation.html?lab=trussfem'],
      numberOfRuns: 2,
      settings: { chromeFlags: '--no-sandbox', skipAudits: ['uses-http2'] },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
