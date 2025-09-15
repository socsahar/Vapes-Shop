#!/usr/bin/env node

/**
 * Production Deployment Script for Auto-Manager System
 * 
 * This script sets up the auto-manager system for production hosting environments
 * including Railway, Vercel, Heroku, and other cloud platforms.
 * 
 * Features:
 * - Environment detection and configuration
 * - Cron job setup for various platforms
 * - Database connectivity testing
 * - Log management for production
 * - Health check endpoints
 * - Monitoring and alerting setup
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const ENVIRONMENTS = {
    RAILWAY: 'railway',
    VERCEL: 'vercel', 
    HEROKU: 'heroku',
    GENERIC: 'generic',
    LOCAL: 'local'
};

// Detect hosting environment
function detectEnvironment() {
    if (process.env.RAILWAY_ENVIRONMENT) return ENVIRONMENTS.RAILWAY;
    if (process.env.VERCEL) return ENVIRONMENTS.VERCEL;
    if (process.env.DYNO) return ENVIRONMENTS.HEROKU;
    if (process.env.NODE_ENV === 'production') return ENVIRONMENTS.GENERIC;
    return ENVIRONMENTS.LOCAL;
}

// Environment-specific configurations
const ENV_CONFIGS = {
    [ENVIRONMENTS.RAILWAY]: {
        name: 'Railway',
        supportsScheduling: false, // Railway needs external cron
        logRetention: '7d',
        cronSuggestion: 'Use Railway Cron addon or GitHub Actions',
        healthEndpoint: true
    },
    [ENVIRONMENTS.VERCEL]: {
        name: 'Vercel',
        supportsScheduling: false, // Vercel Functions have timeout limits
        logRetention: '1d',
        cronSuggestion: 'Use Vercel Cron Jobs or external service',
        healthEndpoint: true
    },
    [ENVIRONMENTS.HEROKU]: {
        name: 'Heroku',
        supportsScheduling: true, // Heroku Scheduler addon
        logRetention: '7d',
        cronSuggestion: 'Use Heroku Scheduler addon',
        healthEndpoint: true
    },
    [ENVIRONMENTS.GENERIC]: {
        name: 'Generic Production',
        supportsScheduling: true,
        logRetention: '30d',
        cronSuggestion: 'Set up system cron job',
        healthEndpoint: true
    },
    [ENVIRONMENTS.LOCAL]: {
        name: 'Local Development',
        supportsScheduling: true,
        logRetention: '3d',
        cronSuggestion: 'Use Windows Task Scheduler or Unix cron',
        healthEndpoint: false
    }
};

class ProductionDeployer {
    constructor() {
        this.environment = detectEnvironment();
        this.config = ENV_CONFIGS[this.environment];
        this.projectRoot = path.resolve(__dirname);
        this.logFile = path.join(this.projectRoot, 'deployment.log');
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        
        console.log(logMessage);
        if (data) {
            console.log(JSON.stringify(data, null, 2));
        }

        // Write to deployment log
        try {
            const fileMessage = data 
                ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
                : `${logMessage}\n`;
            fs.appendFileSync(this.logFile, fileMessage);
        } catch (error) {
            console.error('Failed to write to deployment log:', error);
        }
    }

    async testDatabaseConnection() {
        this.log('info', 'Testing database connection...');
        
        try {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data, error } = await supabase
                .from('general_orders')
                .select('id')
                .limit(1);

            if (error) {
                throw new Error(`Database connection failed: ${error.message}`);
            }

            this.log('info', '✅ Database connection successful');
            return true;

        } catch (error) {
            this.log('error', '❌ Database connection failed', { error: error.message });
            return false;
        }
    }

    checkRequiredEnvironmentVariables() {
        const required = [
            'NEXT_PUBLIC_SUPABASE_URL',
            'SUPABASE_SERVICE_ROLE_KEY'
        ];

        const optional = [
            'NEXT_PUBLIC_SITE_URL',
            'AUTO_MANAGE_LOG_LEVEL',
            'AUTO_MANAGE_DRY_RUN',
            'RESEND_API_KEY'
        ];

        const missing = required.filter(key => !process.env[key]);
        const present = optional.filter(key => process.env[key]);

        this.log('info', 'Environment variables check', {
            required: {
                total: required.length,
                present: required.length - missing.length,
                missing: missing
            },
            optional: {
                total: optional.length,
                present: present.length,
                configured: present
            }
        });

        return missing.length === 0;
    }

    createProductionPackageJson() {
        const packagePath = path.join(this.projectRoot, 'package.json');
        let packageJson;

        try {
            packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        } catch (error) {
            this.log('warn', 'Could not read package.json, creating minimal one');
            packageJson = {
                name: "vapes-shop-auto-manager",
                version: "1.0.0",
                private: true
            };
        }

        // Add production scripts
        if (!packageJson.scripts) packageJson.scripts = {};
        
        packageJson.scripts = {
            ...packageJson.scripts,
            'auto-manager': 'node standalone-auto-manager.js',
            'auto-manager:dry': 'AUTO_MANAGE_DRY_RUN=true node standalone-auto-manager.js',
            'deploy:setup': 'node production-deploy.js',
            'health-check': 'node health-check.js'
        };

        // Ensure required dependencies
        if (!packageJson.dependencies) packageJson.dependencies = {};
        if (!packageJson.dependencies['@supabase/supabase-js']) {
            packageJson.dependencies['@supabase/supabase-js'] = '^2.0.0';
        }

        fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
        this.log('info', '✅ Updated package.json with production scripts');
    }

    createHealthCheckEndpoint() {
        const healthCheckPath = path.join(this.projectRoot, 'health-check.js');
        
        const healthCheckContent = `#!/usr/bin/env node

/**
 * Health Check Endpoint for Auto-Manager System
 * 
 * This script provides health status for monitoring systems
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function healthCheck() {
    const status = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        checks: {
            environment: process.env.NODE_ENV || 'development',
            database: false,
            logs: false,
            lastRun: null
        },
        errors: []
    };

    try {
        // Check database connection
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { error } = await supabase
            .from('general_orders')
            .select('id')
            .limit(1);

        status.checks.database = !error;
        if (error) {
            status.errors.push(\`Database: \${error.message}\`);
        }

        // Check log files
        const logFile = path.join(__dirname, 'logs', 'auto-manager.log');
        if (fs.existsSync(logFile)) {
            status.checks.logs = true;
            const stats = fs.statSync(logFile);
            status.checks.lastRun = stats.mtime.toISOString();
        }

        // Determine overall status
        if (status.errors.length > 0) {
            status.status = 'unhealthy';
        }

    } catch (error) {
        status.status = 'unhealthy';
        status.errors.push(\`System: \${error.message}\`);
    }

    return status;
}

if (require.main === module) {
    healthCheck()
        .then(status => {
            console.log(JSON.stringify(status, null, 2));
            process.exit(status.status === 'healthy' ? 0 : 1);
        })
        .catch(error => {
            console.error('Health check failed:', error);
            process.exit(1);
        });
}

module.exports = { healthCheck };
`;

        fs.writeFileSync(healthCheckPath, healthCheckContent);
        this.log('info', '✅ Created health check endpoint');
    }

    createEnvironmentSpecificFiles() {
        switch (this.environment) {
            case ENVIRONMENTS.RAILWAY:
                this.createRailwayConfig();
                break;
            case ENVIRONMENTS.VERCEL:
                this.createVercelConfig();
                break;
            case ENVIRONMENTS.HEROKU:
                this.createHerokuConfig();
                break;
            default:
                this.createGenericConfig();
        }
    }

    createRailwayConfig() {
        // Create railway.json for Railway deployment
        const railwayConfig = {
            "build": {
                "builder": "NIXPACKS"
            },
            "deploy": {
                "startCommand": "echo 'Auto-manager deployed successfully. Use Railway Cron addon or GitHub Actions for scheduling.'"
            }
        };

        fs.writeFileSync(
            path.join(this.projectRoot, 'railway.json'),
            JSON.stringify(railwayConfig, null, 2)
        );

        // Create GitHub Action for Railway cron
        const ghActionsDir = path.join(this.projectRoot, '.github', 'workflows');
        if (!fs.existsSync(ghActionsDir)) {
            fs.mkdirSync(ghActionsDir, { recursive: true });
        }

        const cronAction = `name: Auto-Manager Cron

on:
  schedule:
    # Run every 10 minutes
    - cron: '*/10 * * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  auto-manager:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Railway Deployment Hook
        run: |
          curl -X POST "https://api.railway.app/project/\${{ secrets.RAILWAY_PROJECT_ID }}/service/\${{ secrets.RAILWAY_SERVICE_ID }}/webhook" \\
            -H "Authorization: Bearer \${{ secrets.RAILWAY_TOKEN }}" \\
            -H "Content-Type: application/json" \\
            -d '{"command": "npm run auto-manager"}'
`;

        fs.writeFileSync(
            path.join(ghActionsDir, 'railway-cron.yml'),
            cronAction
        );

        this.log('info', '✅ Created Railway configuration and GitHub Action');
    }

    createVercelConfig() {
        // Create vercel.json
        const vercelConfig = {
            "functions": {
                "api/auto-manager.js": {
                    "maxDuration": 300
                }
            },
            "crons": [
                {
                    "path": "/api/auto-manager",
                    "schedule": "*/10 * * * *"
                }
            ]
        };

        fs.writeFileSync(
            path.join(this.projectRoot, 'vercel.json'),
            JSON.stringify(vercelConfig, null, 2)
        );

        // Create API endpoint for Vercel
        const apiDir = path.join(this.projectRoot, 'api');
        if (!fs.existsSync(apiDir)) {
            fs.mkdirSync(apiDir, { recursive: true });
        }

        const vercelHandler = `const { runAutoManager } = require('../standalone-auto-manager');

export default async function handler(req, res) {
    try {
        const result = await runAutoManager();
        
        res.status(200).json({
            success: result.success,
            message: result.success 
                ? \`Processed \${result.totalProcessed} orders (\${result.opened} opened, \${result.closed} closed)\`
                : result.error,
            timestamp: new Date().toISOString(),
            result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}
`;

        fs.writeFileSync(path.join(apiDir, 'auto-manager.js'), vercelHandler);
        this.log('info', '✅ Created Vercel configuration and API endpoint');
    }

    createHerokuConfig() {
        // Create Procfile
        const procfile = `web: echo "Auto-manager service ready"
worker: npm run auto-manager`;

        fs.writeFileSync(path.join(this.projectRoot, 'Procfile'), procfile);

        // Create app.json for Heroku Button deployment
        const appJson = {
            "name": "Vapes Shop Auto-Manager",
            "description": "Automatic management system for vape shop general orders",
            "keywords": ["nodejs", "supabase", "automation"],
            "env": {
                "NEXT_PUBLIC_SUPABASE_URL": {
                    "description": "Supabase project URL"
                },
                "SUPABASE_SERVICE_ROLE_KEY": {
                    "description": "Supabase service role key"
                },
                "AUTO_MANAGE_LOG_LEVEL": {
                    "value": "info",
                    "required": false
                }
            },
            "addons": [
                "scheduler:standard"
            ]
        };

        fs.writeFileSync(
            path.join(this.projectRoot, 'app.json'),
            JSON.stringify(appJson, null, 2)
        );

        this.log('info', '✅ Created Heroku configuration (Procfile, app.json)');
        this.log('info', 'Note: Configure Heroku Scheduler to run "npm run auto-manager" every 10 minutes');
    }

    createGenericConfig() {
        // Create Docker support
        const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY standalone-auto-manager.js health-check.js ./
RUN mkdir -p logs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=5m --timeout=30s --start-period=5s --retries=3 \\
    CMD node health-check.js

# Default command for health endpoint
CMD ["node", "-e", "require('http').createServer((req, res) => { res.writeHead(200, {'Content-Type': 'application/json'}); require('./health-check').healthCheck().then(status => res.end(JSON.stringify(status))); }).listen(3000, () => console.log('Health endpoint running on port 3000'));"]
`;

        fs.writeFileSync(path.join(this.projectRoot, 'Dockerfile'), dockerfile);

        // Create docker-compose for development
        const dockerCompose = `version: '3.8'

services:
  auto-manager:
    build: .
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_SUPABASE_URL=\${NEXT_PUBLIC_SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=\${SUPABASE_SERVICE_ROLE_KEY}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "health-check.js"]
      interval: 5m
      timeout: 30s
      retries: 3

  cron:
    image: alpine:latest
    command: >
      sh -c "
        apk add --no-cache curl &&
        echo '*/10 * * * * curl -f http://auto-manager:3000/health || exit 1' > /etc/crontabs/root &&
        crond -f
      "
    depends_on:
      - auto-manager
    restart: unless-stopped
`;

        fs.writeFileSync(path.join(this.projectRoot, 'docker-compose.yml'), dockerCompose);

        this.log('info', '✅ Created Docker configuration');
    }

    generateDeploymentInstructions() {
        const instructions = `
# Auto-Manager Production Deployment Instructions

## Environment: ${this.config.name}

### Prerequisites
- Node.js 18+ installed
- Supabase project with service role key
- Required environment variables configured

### Required Environment Variables
\`\`\`
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production
\`\`\`

### Optional Environment Variables
\`\`\`
NEXT_PUBLIC_SITE_URL=your_website_url
AUTO_MANAGE_LOG_LEVEL=info
AUTO_MANAGE_DRY_RUN=false
RESEND_API_KEY=your_resend_key
\`\`\`

### Installation
1. Copy these files to your production server:
   - standalone-auto-manager.js
   - health-check.js
   - package.json

2. Install dependencies:
   \`\`\`bash
   npm install --production
   \`\`\`

3. Test the system:
   \`\`\`bash
   npm run auto-manager:dry
   \`\`\`

### Scheduling (${this.config.cronSuggestion})

${this.environment === ENVIRONMENTS.RAILWAY ? `
**Railway with GitHub Actions:**
1. Set up repository secrets:
   - RAILWAY_PROJECT_ID
   - RAILWAY_SERVICE_ID  
   - RAILWAY_TOKEN
2. GitHub Action will run every 10 minutes automatically

**Alternative - External Cron Service:**
Use a service like cron-job.org to call your Railway app endpoint every 10 minutes.
` : ''}

${this.environment === ENVIRONMENTS.VERCEL ? `
**Vercel Cron Jobs:**
The vercel.json file includes cron configuration. Vercel will automatically run the function every 10 minutes.

**Alternative - GitHub Actions:**
Use the provided GitHub Action to trigger the Vercel function.
` : ''}

${this.environment === ENVIRONMENTS.HEROKU ? `
**Heroku Scheduler:**
1. Add Heroku Scheduler addon: \`heroku addons:create scheduler:standard\`
2. Configure job: \`npm run auto-manager\` to run every 10 minutes
3. View logs: \`heroku logs --tail --app your-app-name\`
` : ''}

${this.environment === ENVIRONMENTS.GENERIC ? `
**System Cron Job (Linux/macOS):**
\`\`\`bash
# Edit crontab
crontab -e

# Add this line (run every 10 minutes)
*/10 * * * * cd /path/to/your/app && npm run auto-manager >> logs/cron.log 2>&1
\`\`\`

**Docker:**
\`\`\`bash
docker-compose up -d
\`\`\`

**Systemd Service (Linux):**
Create /etc/systemd/system/auto-manager.service and enable it.
` : ''}

### Monitoring
- Health check endpoint: \`npm run health-check\`
- View logs: Check logs/auto-manager.log
- Log retention: ${this.config.logRetention}

### Troubleshooting
1. **Database connection issues:**
   - Verify Supabase credentials
   - Check network connectivity

2. **Cron not running:**
   - Check platform-specific scheduler configuration
   - Verify environment variables are set

3. **High memory usage:**
   - Enable log rotation
   - Monitor log file sizes

### Support
- Check deployment.log for setup issues
- Use dry run mode for testing: \`npm run auto-manager:dry\`
- Monitor with health checks
`;

        fs.writeFileSync(
            path.join(this.projectRoot, 'DEPLOYMENT_INSTRUCTIONS.md'),
            instructions
        );

        this.log('info', '✅ Generated deployment instructions');
    }

    async deploy() {
        this.log('info', '🚀 Starting production deployment setup', {
            environment: this.environment,
            config: this.config
        });

        // 1. Check environment variables
        if (!this.checkRequiredEnvironmentVariables()) {
            throw new Error('Missing required environment variables');
        }

        // 2. Test database connection
        const dbConnected = await this.testDatabaseConnection();
        if (!dbConnected) {
            throw new Error('Database connection test failed');
        }

        // 3. Create production files
        this.createProductionPackageJson();
        this.createHealthCheckEndpoint();
        this.createEnvironmentSpecificFiles();
        this.generateDeploymentInstructions();

        // 4. Test the auto-manager
        this.log('info', 'Testing auto-manager in dry-run mode...');
        
        try {
            const { runAutoManager } = require(path.join(this.projectRoot, 'standalone-auto-manager.js'));
            
            // Set dry run mode for testing
            process.env.AUTO_MANAGE_DRY_RUN = 'true';
            const testResult = await runAutoManager();
            
            this.log('info', '✅ Auto-manager test completed successfully', {
                result: testResult
            });
        } catch (error) {
            this.log('error', '❌ Auto-manager test failed', { error: error.message });
            throw error;
        }

        this.log('info', '🎉 Production deployment setup completed successfully!', {
            environment: this.config.name,
            nextSteps: [
                'Configure environment variables on your hosting platform',
                'Set up scheduling as described in DEPLOYMENT_INSTRUCTIONS.md',
                'Monitor logs and health checks after deployment'
            ]
        });

        return {
            success: true,
            environment: this.environment,
            config: this.config
        };
    }
}

// Execute if run directly
if (require.main === module) {
    const deployer = new ProductionDeployer();
    
    deployer.deploy()
        .then(result => {
            console.log('✅ Deployment setup completed successfully!');
            console.log(`📖 Check DEPLOYMENT_INSTRUCTIONS.md for ${result.config.name}-specific setup steps`);
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Deployment setup failed:', error.message);
            process.exit(1);
        });
}

module.exports = { ProductionDeployer, detectEnvironment, ENV_CONFIGS };