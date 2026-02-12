const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const versionType = process.argv[2]; // patch, minor, major

if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('Usage: node scripts/bump-version.js [patch|minor|major]');
  process.exit(1);
}

// Function to prompt user for confirmation
function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

// Main function
async function main() {
  // Read current version
  const currentPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const currentVersion = currentPkg.version;

  // Calculate new version
  const versionParts = currentVersion.split('.').map(Number);
  let newVersion;

  if (versionType === 'patch') {
    newVersion = `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`;
  } else if (versionType === 'minor') {
    newVersion = `${versionParts[0]}.${versionParts[1] + 1}.0`;
  } else if (versionType === 'major') {
    newVersion = `${versionParts[0] + 1}.0.0`;
  }

  // Show confirmation prompt
  console.log(`\n📦 Current version: v${currentVersion}`);
  console.log(`📦 New version: v${newVersion}\n`);

  const confirmed = await confirm('Do you want to proceed with this version bump? (yes/y): ');

  if (!confirmed) {
    console.log('\n❌ Version bump cancelled.');
    process.exit(1);
  }

  console.log('');

  // Update root package.json
  execSync(`npm version ${versionType} --no-git-tag-version`, { stdio: 'inherit' });

  // Read new version from root package.json (to ensure it matches npm's calculation)
  const rootPkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  const actualNewVersion = rootPkg.version;

  // Update webview package.json
  const webviewPkgPath = './webview/package.json';
  const webviewPkg = JSON.parse(fs.readFileSync(webviewPkgPath, 'utf8'));
  webviewPkg.version = actualNewVersion;
  fs.writeFileSync(webviewPkgPath, JSON.stringify(webviewPkg, null, 2) + '\n');

  console.log(`✓ Updated both package.json files to v${actualNewVersion}`);

  // Git commit and tag
  execSync('git add package.json webview/package.json', { stdio: 'inherit' });
  execSync(`git commit -m "${actualNewVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${actualNewVersion}`, { stdio: 'inherit' });

  console.log(`✓ Created git commit and tag v${actualNewVersion}`);
}

// Run main function
main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
