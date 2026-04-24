module.exports = {
  apps: [
    {
      name: 'mashina-api-prod',
      cwd: '/opt/mashina-prod/api',
      script: 'dist/main.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'mashina-api-dev',
      cwd: '/opt/mashina-dev/api',
      script: 'dist/main.js',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
