const { execSync } = require('child_process');
const readline = require('readline');

function askOTP() {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter NPM OTP code: ', (otp) => {
            rl.close();
            resolve(otp?.trim() || '');
        });
    });
}

async function deploy() {
    try {
        // Check npm login status
        console.log('\n🔐 Checking npm login...');
        try {
            execSync('npm whoami', { stdio: 'pipe' });
            console.log('✓ Logged in to npm');
        } catch {
            console.log('Not logged in. Please login to npm:');
            execSync('npm login', { stdio: 'inherit' });
        }

        // Version bump
        console.log('\n📦 Bumping version...');
        execSync('npm version patch --no-git-tag-version', { stdio: 'inherit' });

        // Build
        console.log('\n🔨 Building...');
        execSync('npm run build', { stdio: 'inherit' });

        // Deploy binaries
        console.log('\n☁️  Deploying binaries...');
        execSync('npm run deploy:linux', { stdio: 'inherit' });
        execSync('npm run deploy:macos', { stdio: 'inherit' });
        execSync('npm run deploy:win', { stdio: 'inherit' });

        // Deploy templates
        console.log('\n📄 Deploying templates...');
        execSync('npm run deploy:templates', { stdio: 'inherit' });

        // Deploy version
        console.log('\n🏷️  Deploying version...');
        execSync('npm run deploy:version', { stdio: 'inherit' });

        // Ask for OTP right before publish
        console.log('\n🚀 Ready to publish to npm...');
        const otp = await askOTP();

        if (otp) {
            execSync(`npm publish --otp=${otp}`, { stdio: 'inherit' });
            console.log('\n✅ Deploy complete!');
        } else {
            console.log('\n⚠️  Skipped npm publish (no OTP provided)');
            console.log('✅ S3 deploy complete!');
        }
    } catch (error) {
        console.error('\n❌ Deploy failed:', error.message);
        process.exit(1);
    }
}

deploy();
