// Comprehensive Environment Configuration for Decision Aid
// Provides centralized, typed, and validated environment variable management

export interface EnvironmentVariables {
  // Core application settings
  nodeEnv: 'development' | 'production' | 'staging' | 'test';
  isDevelopment: boolean;
  isProduction: boolean;
  baseUrl: string;
  
  // OpenAI Configuration
  openai: {
    apiKey: string | null;
    assistantId: string | null;
    projectId: string | null;
    hasCredentials: boolean;
  };
  
  // Supabase Configuration
  supabase: {
    url: string | null;
    anonKey: string | null;
    hasCredentials: boolean;
    functionsUrl: string;
  };
  
  // Local development
  development: {
    functionsUrl: string | null;
    hmrPort: number;
    enableDevTools: boolean;
    debugMode: boolean;
  };
  
  // Analysis configuration
  analysis: {
    defaultMaxInsights: number;
    timeoutMs: number;
    enableRouterDebug: boolean;
  };
  
  // Feature flags
  features: {
    experimental: boolean;
    performanceMonitoring: boolean;
    debugLogging: boolean;
    a2aIntegration: boolean;
  };
  
  // Integration settings
  integration: {
    ceciApiUrl: string;
    ceciUiUrl: string;
    decisionAidUrl: string;
  };
  
  // Performance settings
  performance: {
    chunkSizeWarningLimit: number;
    enableCodeSplitting: boolean;
    enableResponseCaching: boolean;
    cacheTtlSeconds: number;
  };
  
  // Router configuration
  router: {
    retryAttempts: number;
    timeoutMs: number;
    backoffFactor: number;
  };
}

// Environment variable validation rules
interface ValidationRule {
  key: string;
  required: boolean;
  defaultValue?: any;
  validator?: (value: string) => boolean;
  transformer?: (value: string) => any;
}

const VALIDATION_RULES: ValidationRule[] = [
  // Core variables
  { key: 'NODE_ENV', required: false, defaultValue: 'development' },
  { key: 'VITE_BASE_URL', required: false, defaultValue: '/decision-aid' },
  
  // OpenAI variables
  { key: 'VITE_OPENAI_API_KEY', required: false, defaultValue: null },
  { key: 'VITE_ASSISTANT_ID', required: false, defaultValue: null },
  { key: 'VITE_OPENAI_PROJECT_ID', required: false, defaultValue: null },
  
  // Supabase variables
  { key: 'VITE_SUPABASE_URL', required: false, defaultValue: null },
  { key: 'VITE_SUPABASE_ANON_KEY', required: false, defaultValue: null },
  
  // Development variables
  { key: 'VITE_LOCAL_FUNCTIONS_URL', required: false, defaultValue: null },
  { key: 'VITE_HMR_PORT', required: false, defaultValue: 5174, transformer: (v) => parseInt(v) },
  { key: 'ENABLE_REACT_DEVTOOLS', required: false, defaultValue: true, transformer: (v) => v === 'true' },
  { key: 'DEBUG_MODE', required: false, defaultValue: false, transformer: (v) => v === 'true' },
  
  // Analysis configuration
  { key: 'VITE_DEFAULT_MAX_INSIGHTS', required: false, defaultValue: 24, transformer: (v) => parseInt(v) },
  { key: 'VITE_ANALYSIS_TIMEOUT', required: false, defaultValue: 30000, transformer: (v) => parseInt(v) },
  { key: 'VITE_DEBUG_ROUTER', required: false, defaultValue: false, transformer: (v) => v === 'true' },
  
  // Feature flags
  { key: 'VITE_ENABLE_EXPERIMENTAL_FEATURES', required: false, defaultValue: false, transformer: (v) => v === 'true' },
  { key: 'VITE_ENABLE_PERFORMANCE_MONITORING', required: false, defaultValue: true, transformer: (v) => v === 'true' },
  { key: 'VITE_ENABLE_DEBUG_LOGGING', required: false, defaultValue: false, transformer: (v) => v === 'true' },
  { key: 'ENABLE_A2A_INTEGRATION', required: false, defaultValue: false, transformer: (v) => v === 'true' },
  
  // Integration settings
  { key: 'VITE_CECI_API_URL', required: false, defaultValue: 'http://localhost:9000' },
  { key: 'VITE_CECI_UI_URL', required: false, defaultValue: 'http://localhost:8080' },
  { key: 'VITE_DECISION_AID_URL', required: false, defaultValue: 'http://localhost:8082' },
  
  // Performance settings
  { key: 'VITE_CHUNK_SIZE_WARNING_LIMIT', required: false, defaultValue: 1000, transformer: (v) => parseInt(v) },
  { key: 'VITE_ENABLE_CODE_SPLITTING', required: false, defaultValue: true, transformer: (v) => v === 'true' },
  { key: 'ENABLE_RESPONSE_CACHING', required: false, defaultValue: true, transformer: (v) => v === 'true' },
  { key: 'CACHE_TTL_SECONDS', required: false, defaultValue: 300, transformer: (v) => parseInt(v) },
  
  // Router configuration
  { key: 'ROUTER_RETRY_ATTEMPTS', required: false, defaultValue: 3, transformer: (v) => parseInt(v) },
  { key: 'ROUTER_TIMEOUT_MS', required: false, defaultValue: 15000, transformer: (v) => parseInt(v) },
  { key: 'ROUTER_BACKOFF_FACTOR', required: false, defaultValue: 2, transformer: (v) => parseFloat(v) },
];

// Get environment variable with fallback logic
function getEnvVar(key: string, defaultValue?: any): any {
  // Check Vite environment variables first (browser)
  if (typeof window !== 'undefined' && import.meta?.env) {
    const value = import.meta.env[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  
  // Check process environment variables (Node.js/SSR)
  if (typeof process !== 'undefined' && process?.env) {
    const value = process.env[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  
  // Return default value
  return defaultValue;
}

// Validate and transform environment variables
function validateAndTransform(): Record<string, any> {
  const result: Record<string, any> = {};
  const errors: string[] = [];
  
  for (const rule of VALIDATION_RULES) {
    const rawValue = getEnvVar(rule.key, rule.defaultValue);
    
    // Check if required variable is missing
    if (rule.required && (rawValue === null || rawValue === undefined || rawValue === '')) {
      errors.push(`Required environment variable ${rule.key} is missing`);
      continue;
    }
    
    // Apply validator if present
    if (rule.validator && rawValue !== null && !rule.validator(rawValue)) {
      errors.push(`Environment variable ${rule.key} failed validation: ${rawValue}`);
      continue;
    }
    
    // Apply transformer if present
    let finalValue = rawValue;
    if (rule.transformer && rawValue !== null && rawValue !== undefined) {
      try {
        finalValue = rule.transformer(rawValue);
      } catch (error) {
        errors.push(`Failed to transform environment variable ${rule.key}: ${error}`);
        continue;
      }
    }
    
    result[rule.key] = finalValue;
  }
  
  // Report validation errors
  if (errors.length > 0) {
    console.warn('🔧 Environment validation warnings:', errors);
  }
  
  return result;
}

// Create typed environment configuration
function createEnvironmentConfig(): EnvironmentVariables {
  const env = validateAndTransform();
  
  const nodeEnv = env['NODE_ENV'] || 'development';
  const isDevelopment = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';
  
  return {
    // Core application settings
    nodeEnv: nodeEnv as 'development' | 'production' | 'staging' | 'test',
    isDevelopment,
    isProduction,
    baseUrl: env['VITE_BASE_URL'] || '/decision-aid',
    
    // OpenAI Configuration
    openai: {
      apiKey: env['VITE_OPENAI_API_KEY'],
      assistantId: env['VITE_ASSISTANT_ID'],
      projectId: env['VITE_OPENAI_PROJECT_ID'],
      hasCredentials: !!(env['VITE_OPENAI_API_KEY'] && env['VITE_ASSISTANT_ID']),
    },
    
    // Supabase Configuration
    supabase: {
      url: env['VITE_SUPABASE_URL'],
      anonKey: env['VITE_SUPABASE_ANON_KEY'],
      hasCredentials: !!(env['VITE_SUPABASE_URL'] && env['VITE_SUPABASE_ANON_KEY']),
      functionsUrl: env['VITE_LOCAL_FUNCTIONS_URL'] || 
                   (env['VITE_SUPABASE_URL'] ? `${env['VITE_SUPABASE_URL']}/functions/v1` : ''),
    },
    
    // Local development
    development: {
      functionsUrl: env['VITE_LOCAL_FUNCTIONS_URL'],
      hmrPort: env['VITE_HMR_PORT'] || 5174,
      enableDevTools: env['ENABLE_REACT_DEVTOOLS'] !== false,
      debugMode: env['DEBUG_MODE'] === true,
    },
    
    // Analysis configuration
    analysis: {
      defaultMaxInsights: env['VITE_DEFAULT_MAX_INSIGHTS'] || 24,
      timeoutMs: env['VITE_ANALYSIS_TIMEOUT'] || 30000,
      enableRouterDebug: env['VITE_DEBUG_ROUTER'] === true,
    },
    
    // Feature flags
    features: {
      experimental: env['VITE_ENABLE_EXPERIMENTAL_FEATURES'] === true,
      performanceMonitoring: env['VITE_ENABLE_PERFORMANCE_MONITORING'] !== false,
      debugLogging: env['VITE_ENABLE_DEBUG_LOGGING'] === true,
      a2aIntegration: env['ENABLE_A2A_INTEGRATION'] === true,
    },
    
    // Integration settings
    integration: {
      ceciApiUrl: env['VITE_CECI_API_URL'] || 'http://localhost:9000',
      ceciUiUrl: env['VITE_CECI_UI_URL'] || 'http://localhost:8080',
      decisionAidUrl: env['VITE_DECISION_AID_URL'] || 'http://localhost:8082',
    },
    
    // Performance settings
    performance: {
      chunkSizeWarningLimit: env['VITE_CHUNK_SIZE_WARNING_LIMIT'] || 1000,
      enableCodeSplitting: env['VITE_ENABLE_CODE_SPLITTING'] !== false,
      enableResponseCaching: env['ENABLE_RESPONSE_CACHING'] !== false,
      cacheTtlSeconds: env['CACHE_TTL_SECONDS'] || 300,
    },
    
    // Router configuration
    router: {
      retryAttempts: env['ROUTER_RETRY_ATTEMPTS'] || 3,
      timeoutMs: env['ROUTER_TIMEOUT_MS'] || 15000,
      backoffFactor: env['ROUTER_BACKOFF_FACTOR'] || 2,
    },
  };
}

// Singleton environment configuration
let environmentConfig: EnvironmentVariables | null = null;

export function getEnvironmentConfig(): EnvironmentVariables {
  if (!environmentConfig) {
    environmentConfig = createEnvironmentConfig();
    
    // Log configuration in development
    if (environmentConfig.isDevelopment && environmentConfig.features.debugLogging) {
      console.log('🔧 Environment configuration loaded:', {
        nodeEnv: environmentConfig.nodeEnv,
        hasOpenAI: environmentConfig.openai.hasCredentials,
        hasSupabase: environmentConfig.supabase.hasCredentials,
        functionsUrl: environmentConfig.supabase.functionsUrl,
        features: environmentConfig.features,
      });
    }
  }
  
  return environmentConfig;
}

// Environment validation status
export interface EnvironmentStatus {
  isValid: boolean;
  hasOpenAI: boolean;
  hasSupabase: boolean;
  warnings: string[];
  recommendations: string[];
}

export function validateEnvironment(): EnvironmentStatus {
  const config = getEnvironmentConfig();
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  // Check OpenAI configuration
  if (!config.openai.hasCredentials) {
    warnings.push('OpenAI credentials not configured - AI analysis will be limited');
    recommendations.push('Set VITE_OPENAI_API_KEY and VITE_ASSISTANT_ID environment variables');
  }
  
  // Check Supabase configuration
  if (!config.supabase.hasCredentials) {
    warnings.push('Supabase credentials not configured - remote functions unavailable');
    recommendations.push('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables');
  }
  
  // Check development setup
  if (config.isDevelopment && !config.development.functionsUrl) {
    recommendations.push('Set VITE_LOCAL_FUNCTIONS_URL for local development testing');
  }
  
  // Performance recommendations
  if (config.analysis.defaultMaxInsights > 32) {
    recommendations.push('Consider reducing VITE_DEFAULT_MAX_INSIGHTS for better performance');
  }
  
  return {
    isValid: warnings.length === 0,
    hasOpenAI: config.openai.hasCredentials,
    hasSupabase: config.supabase.hasCredentials,
    warnings,
    recommendations,
  };
}

// Export the configuration for immediate use
export const env = getEnvironmentConfig();

// Development helper to log environment status
if (env.isDevelopment && typeof window !== 'undefined') {
  const status = validateEnvironment();
  console.log('🌍 Environment Status:', status);
  
  if (status.warnings.length > 0) {
    console.warn('⚠️ Environment Warnings:', status.warnings);
  }
  
  if (status.recommendations.length > 0) {
    console.info('💡 Environment Recommendations:', status.recommendations);
  }
}