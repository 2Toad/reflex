# Contribute to the Reflex project 🤝

Thank you for wanting to contribute to the Reflex project. With your contributions we can ensure Relfex remains a reliable, efficient, and developer-friendly reactive state management system.

## Steps for success

1. [Issues](https://github.com/2Toad/reflex/issues):
   1. Always work off of an Issue. Please do not submit a Pull Request that is not associated with an Issue (create the Issue if necessary).
   2. If you are beginning work on an Issue, please leave a comment on the issue letting us know, and we'll assign the Issue to you. This way somebody else won't start working on the same Issue.
2. [Branches](https://github.com/2Toad/reflex/branches):
   1. Always branch off of `main`, which contains the latest version of Reflex
3. [Pull Request](https://github.com/2Toad/reflex/pulls) (PR):
   1. Make sure you run the following scripts in local, and that all of them pass, before submitting a PR:
      1. `npm run lint:fix`
      2. `npm run format`
      3. `npm test`
      4. `npm run test:package`
   2. Make sure your PR is targeting the correct branch (see Step 2.i)
   3. At the top of your PR description write: "Fixes #_n_". Where _n_ is the number of the Issue your PR is fixing (e.g., `Fixes #33`). This will tell GitHub to associate your PR with the Issue.

## Development 

### Prerequisites

- Node: [Node 22+](https://nodejs.org)

### Source Code

1. Clone the repo
2. Change directories: `cd reflex`
3. Install dependencies: `npm i`

### Development

Start app in watch mode: `npm run local`

>When file changes are detected, the app will automatically rebuild/restart

#### Linting

- Check lint rules: `npm run lint`
- Fix lint errors: `npm run lint:fix`
- Fix formatting errors: `npm run format`

#### Testing

- Unit tests: `npm test`
- Unit test development: `npm run test:watch`
- Package tests: `npm run test:package`
  - Builds and tests the package in both ESM and CommonJS environments
  - Validates correct module loading and basic functionality
  - Reports success/failure with detailed output
  - Keeps test files on failure for debugging
  - Provides cleanup option on completion

## Appendix

### Dev Tools

The following section includes optional dev tools that enhance the Reflex development experience, but are not necessary.

#### NVM

This project includes an .nvmrc file, so you can run `nvm use` to switch to the proper version of Node.

1. Install nvm: https://github.com/nvm-sh/nvm
2. Install the Node.js version required by this app: `nvm install`
   1. NVM will determine the required Node version using the .nvmrc file
   2. NVM will install the required Node version if it isn't installed
   3. NVM will set your current Node version to the one required

#### Git Hooks

This project includes Husky for running Git Hooks. Running `git commit` will trigger `lint-staged` which will lint all files currently staged in Git. If linting fails, the commit will be cancelled.

> The `postinstall` script in package.json is automatically called by `npm install` and will configure Husky for use in your local environment.

### Dependencies

- `chai`: we must use v4.x because v5.x is pure ESM, and we require CommonJS modules

### Deployment

Deployments to Prod consist of building and publishing the Reflex lib to NPM, and are automated through our Continuous Deployment workflow.

#### 1. Create New Version
1. Checkout `main`.
2. Increment the version in package.json, using semantic versioning (e.g., `1.1.0`).
3. Rebuild package-lock, to pick up the new version number: `npm i --package-lock-only`.
4. Push changes:
   ```
   git add .
   git commit -m "Bump version to 1.1.0"
   git push
   ```

#### 2. Verify Checks
1. Navigate to the [CI](https://github.com/2Toad/reflex/actions/workflows/ci.yml) workflow.
2. Ensure the build checks for this push succeed.

#### 3. Publish GitHub Release
1. Navigate to [Reflex's releases](https://github.com/2Toad/reflex/releases).
2. Click "Draft a new release":
   - **Choose a tag**: enter version (e.g., `v1.1.0`) and click "Create new tag"
   - **Target**: `main`
   - **Previous tag**: `auto`
   - **Release title**: (e.g., `1.1.0`)
   - **Description**: click the "Generate release notes"
   - [x] **Set as the latest release**
3. Click "Publish release".

> This will trigger the [CDP](https://github.com/2Toad/reflex/actions/workflows/cdp.yml) workflow, which will build and deploy the package to NPM: https://www.npmjs.com/package/@2toad/reflex