// Enhanced Function Router Architecture for Decision Aid Analysis
// Provides standardized routing, configuration, and fallback mechanisms

// Use centralized environment configuration
import { env, EnvironmentVariables } from '../config/environment';

export interface FunctionConfig {
  name: string;
  timeout: number;
  maxRetries: number;
  priority: number;
  requiresAuth: boolean;
  supportedFeatures: string[];
}

export interface AnalysisRequest {
  content: string;
  maxInsights?: number;
  outputScores?: boolean;
  chunkSize?: number;
}

export interface AnalysisResponse {
  insights: any[];
  criteria?: any[];
  summary?: any;
  meta: {
    source: 'assistants' | 'openai' | 'local';
    version?: string;
    fallback?: boolean;
    functionUsed: string;
    executionTime: number;
    retryCount?: number;
  };
}

// Standardized function configurations with environment-aware timeouts
export const FUNCTION_CONFIGS: Record<string, FunctionConfig> = {
  'analyze-assistant': {
    name: 'analyze-assistant',
    timeout: 45000, // 45 seconds - Assistant API is slow
    maxRetries: 1, // Reduce retries for slow function
    priority: 2, // Lower priority due to JSON structure issues
    requiresAuth: true,
    supportedFeatures: ['assistant-api', 'complex-reasoning', 'hebrew', 'evidence-extraction']
  },
  'analyze-openai': {
    name: 'analyze-openai',
    timeout: 30000, // 30 seconds - Chat API is faster
    maxRetries: 2, // Moderate retries
    priority: 1, // Highest priority - returns proper criterionIds
    requiresAuth: true,
    supportedFeatures: ['chat-completions', 'fast-response', 'hebrew', 'json-mode']
  },
  'local-analysis': {
    name: 'local-analysis',
    timeout: 5000, // 5 seconds - local processing
    maxRetries: 0,
    priority: 3, // Lowest priority (fallback)
    requiresAuth: false,
    supportedFeatures: ['offline', 'keyword-matching', 'basic-insights']
  }
};

export interface EnvironmentConfig {
  hasOpenAiKey: boolean;
  hasAssistantId: boolean;
  hasSupabaseUrl: boolean;
  hasSupabaseKey: boolean;
  localFunctionsUrl?: string;
}

export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    hasOpenAiKey: !!env.openai.apiKey,
    hasAssistantId: !!env.openai.assistantId,
    hasSupabaseUrl: !!env.supabase.url,
    hasSupabaseKey: !!env.supabase.anonKey,
    localFunctionsUrl: env.development.functionsUrl || undefined
  };
}

// Smart function selection based on environment and requirements
export function selectOptimalFunction(request: AnalysisRequest, envConfig: EnvironmentConfig): string[] {
  const isLongContent = request.content.length > 4000;
  const needsComplexReasoning = isLongContent || (request.maxInsights || 0) > 16;
  
  const availableFunctions: string[] = [];
  
  // Check analyze-assistant availability and suitability
  if (envConfig.hasOpenAiKey && envConfig.hasAssistantId && needsComplexReasoning) {
    availableFunctions.push('analyze-assistant');
  }
  
  // Check analyze-openai availability
  if (envConfig.hasOpenAiKey) {
    availableFunctions.push('analyze-openai');
  }
  
  // Local analysis is always available as fallback
  availableFunctions.push('local-analysis');
  
  // Sort by priority (lower number = higher priority)
  return availableFunctions.sort((a, b) => {
    const priorityA = FUNCTION_CONFIGS[a]?.priority || 999;
    const priorityB = FUNCTION_CONFIGS[b]?.priority || 999;
    return priorityA - priorityB;
  });
}

// Standardized error types
export class FunctionRouterError extends Error {
  constructor(
    public functionName: string,
    public originalError: Error,
    public retryCount: number = 0
  ) {
    super(`Function ${functionName} failed: ${originalError.message}`);
    this.name = 'FunctionRouterError';
  }
}

// Execution metrics for monitoring
export interface ExecutionMetrics {
  functionName: string;
  startTime: number;
  endTime: number;
  success: boolean;
  error?: string;
  retryCount: number;
}

export class FunctionRouter {
  private metrics: ExecutionMetrics[] = [];
  private envConfig: EnvironmentConfig;
  private supabaseClient: any = null;
  
  constructor(supabaseClient?: any) {
    this.envConfig = getEnvironmentConfig();
    this.supabaseClient = supabaseClient;
    
    // Only log initialization in development or when debug is enabled
    if (env.isDevelopment || env.features.debugLogging || env.analysis.enableRouterDebug) {
      console.log('🔧 FunctionRouter initialized with config:', {
        hasOpenAi: this.envConfig.hasOpenAiKey,
        hasAssistant: this.envConfig.hasAssistantId,
        hasSupabase: this.envConfig.hasSupabaseUrl && this.envConfig.hasSupabaseKey,
        localUrl: this.envConfig.localFunctionsUrl || 'none',
        timeouts: {
          assistant: FUNCTION_CONFIGS['analyze-assistant'].timeout,
          openai: FUNCTION_CONFIGS['analyze-openai'].timeout,
          router: env.router.timeoutMs
        },
        retries: {
          assistant: FUNCTION_CONFIGS['analyze-assistant'].maxRetries,
          openai: FUNCTION_CONFIGS['analyze-openai'].maxRetries,
          router: env.router.retryAttempts
        }
      });
    }
  }
  
  // Get execution metrics for monitoring
  public getMetrics(): ExecutionMetrics[] {
    return [...this.metrics];
  }
  
  // Clear metrics (for testing or reset)
  public clearMetrics(): void {
    this.metrics = [];
  }
  
  // Enhanced routing with standardized error handling and metrics
  public async executeAnalysis(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now();
    const selectedFunctions = selectOptimalFunction(request, this.envConfig);
    
    console.log(`🎯 Function selection for content (${request.content.length} chars):`, selectedFunctions);
    
    let lastError: Error | null = null;
    let retryCount = 0;
    
    for (const functionName of selectedFunctions) {
      const config = FUNCTION_CONFIGS[functionName];
      if (!config) {
        console.warn(`⚠️ Unknown function configuration: ${functionName}`);
        continue;
      }
      
      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        const attemptStart = Date.now();
        retryCount = attempt;
        
        try {
          // Capture function name in closure to prevent any potential issues
          const currentFunctionName = functionName;
          console.log(`🚀 Executing ${currentFunctionName} (attempt ${attempt + 1}/${config.maxRetries + 1})`);
          console.log(`🎯 Function to execute: "${currentFunctionName}" with timeout: ${config.timeout}ms`);
          
          let result: any;
          
          if (currentFunctionName === 'local-analysis') {
            // Local analysis doesn't need network calls
            console.log(`🏠 Executing local analysis (no network call needed)`);
            result = await this.executeLocalAnalysis(request);
          } else {
            // Remote function call with timeout
            console.log(`🌐 Executing remote function: ${currentFunctionName}`);
            result = await Promise.race([
              this.executeRemoteFunction(currentFunctionName, request),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Function ${currentFunctionName} timeout`)), config.timeout)
              )
            ]);
          }
          
          // Standardize the response format
          const standardizedResult: AnalysisResponse = {
            insights: Array.isArray(result?.insights) ? result.insights : [],
            criteria: Array.isArray(result?.criteria) ? result.criteria : undefined,
            summary: result?.summary || null,
            meta: {
              source: result?.meta?.source || (functionName === 'local-analysis' ? 'local' : 'openai'),
              version: result?.meta?.version || `router-v1.0-${functionName}`,
              fallback: selectedFunctions.indexOf(functionName) > 0,
              functionUsed: functionName,
              executionTime: Date.now() - attemptStart,
              retryCount: attempt
            }
          };
          
          // Record success metrics
          this.metrics.push({
            functionName,
            startTime: attemptStart,
            endTime: Date.now(),
            success: true,
            retryCount: attempt
          });
          
          console.log(`✅ ${functionName} succeeded on attempt ${attempt + 1}, execution time: ${standardizedResult.meta.executionTime}ms`);
          return standardizedResult;
          
        } catch (error) {
          const executionTime = Date.now() - attemptStart;
          lastError = error as Error;
          
          // Record failure metrics
          this.metrics.push({
            functionName,
            startTime: attemptStart,
            endTime: Date.now(),
            success: false,
            error: lastError.message,
            retryCount: attempt
          });
          
          // Provide more specific error messages
          const errorType = lastError.message.includes('timeout') ? 'timeout' : 
                          lastError.message.includes('500') ? 'server error' :
                          lastError.message.includes('401') ? 'authentication' :
                          lastError.message.includes('404') ? 'not found' : 'error';
          
          console.warn(`❌ ${functionName} failed on attempt ${attempt + 1}: ${errorType} - ${lastError.message}`);
          
          // Don't retry if it's the last attempt for this function
          if (attempt >= config.maxRetries) {
            console.warn(`🚫 ${functionName} exhausted all ${config.maxRetries + 1} attempts`);
            break;
          }
          
          // Wait before retry (exponential backoff with configured factor)
          if (attempt < config.maxRetries) {
            const baseDelayMs = 1000;
            const backoffMs = Math.min(
              baseDelayMs * Math.pow(env.router.backoffFactor, attempt), 
              5000
            );
            
            if (env.analysis.enableRouterDebug) {
              console.log(`⏳ Waiting ${backoffMs}ms before retry (backoff factor: ${env.router.backoffFactor})...`);
            }
            await new Promise(resolve => setTimeout(resolve, backoffMs));
          }
        }
      }
    }
    
    // All functions failed
    const totalTime = Date.now() - startTime;
    console.error(`💥 All functions failed after ${totalTime}ms. Last error:`, lastError);
    
    // Provide a helpful error message in Hebrew
    const userMessage = lastError?.message.includes('timeout') ? 
      'זמן הניתוח חרג מהמותר. אנא נסו עם טקסט קצר יותר.' :
      lastError?.message.includes('500') ?
      'שגיאת שרת זמנית. אנא נסו שוב בעוד מספר דקות.' :
      'לא הצלחנו לנתח את המסמך. אנא וודאו שהמסמך מכיל טקסט תקין.';
    
    throw new FunctionRouterError(
      selectedFunctions.join(' -> '), 
      new Error(userMessage + ` (${lastError?.message || 'Unknown error'})`),
      retryCount
    );
  }
  
  private async executeRemoteFunction(functionName: string, request: AnalysisRequest): Promise<any> {
    console.log(`🔍 executeRemoteFunction called with functionName: "${functionName}"`);
    console.log(`🔍 Function name type: ${typeof functionName}, value: "${functionName}"`);
    
    // Use local functions URL if available, otherwise use Supabase
    if (this.envConfig.localFunctionsUrl) {
      const url = `${this.envConfig.localFunctionsUrl}/functions/v1/${functionName}`;
      console.log(`📡 Constructed URL: ${url}`);
      console.log(`📡 About to fetch: ${url} with method POST`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      });
      
      console.log(`📡 Response received from ${url}: status ${response.status}`);
      
      if (!response.ok) {
        console.error(`❌ Function ${functionName} at ${url} returned HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      console.log(`✅ Function ${functionName} at ${url} responded successfully`);
      return await response.json();
    } else if (this.supabaseClient) {
      // Use provided Supabase client
      console.log(`🔍 Using Supabase client for function: "${functionName}"`);
      console.log(`📡 Calling Supabase function: ${functionName}`);
      
      const { data, error } = await this.supabaseClient.functions.invoke(functionName, {
        body: request
      });
      
      if (error) {
        console.error(`❌ Supabase function ${functionName} error:`, error.message);
        throw new Error(`Supabase function error: ${error.message}`);
      }
      
      console.log(`✅ Supabase function ${functionName} responded successfully`);
      return data;
    } else {
      throw new Error('No execution method available - provide either localFunctionsUrl or supabaseClient');
    }
  }
  
  private async executeLocalAnalysis(request: AnalysisRequest): Promise<any> {
    // Enhanced Hebrew government decision analysis
    const content = request.content;
    const maxInsights = request.maxInsights || 6;
    
    const rules = [
      {
        criterionId: "timeline",
        terms: ["תאריך", "דד-ליין", "עד", "תוך", "ימים", "שבועות", "חודשים", "לוח זמנים", "מועד", "שלב", "שנתית", "רבעוני", "חודשי"],
        patterns: ["\\d{4}", "\\d{1,2}\\s*ב[א-ת]+", "שלב\\s*[א-ת]", "עד\\s*\\d"],
        explanation: "נדרש לוודא לוחות זמנים מחייבים ובהירים לביצוע.",
        suggestion: "הוסיפו תאריכים מחייבים לכל משימה, אבני דרך ברורות, והגדירו מה קורה באי-עמידה בלוחות הזמנים.",
      },
      {
        criterionId: "resources",
        terms: ["תקציב", "עלות", "מימון", "הוצאה", "ש\"ח", "כספים", "משאבים", "כוח אדם", "מיליון", "אלף", "הקצאה"],
        patterns: ["\\d+\\s*מיליון", "\\d+\\s*אלף", "\\d+\\%", "ש\"ח"],
        explanation: "נדרשת הערכה תקציבית מפורטת והגדרת מקורות מימון.",
        suggestion: "הוסיפו פירוט מלא של עלויות, מקורות מימון מאושרים, כוח אדם נדרש ומנגנון בקרת תקציב.",
      },
      {
        criterionId: "cross_sector",
        terms: ["ציבור", "בעלי עניין", "עמות", "חברה אזרחית", "משרדים", "רשויות", "שיתוף", "תיאום", "בין-משרדי"],
        patterns: ["משרד\\s+[א-ת]+", "רשות\\s+[א-ת]+", "ועדת\\s+[א-ת]+"],
        explanation: "יש להתחשב בבעלי עניין ובצורך בשיתופי פעולה בין-מגזריים.",
        suggestion: "הוסיפו מנגנון שיתוף ציבור מתועד, תיאום בין-משרדי מובנה, ומעורבות בעלי עניין רלוונטיים.",
      },
      {
        criterionId: "evaluation",
        terms: ["הערכה", "מדדי", "ביקורת", "דיווח", "מעקב", "שביעות רצון", "הצלחה", "יעילות", "השפעה"],
        patterns: ["\\d+\\%\\s*שיפור", "מדד\\s+[א-ת]+", "ביקורת\\s+[א-ת]+"],
        explanation: "נדרשים מדדי הערכה ברורים ומנגנון מעקב שיטתי.",
        suggestion: "הגדירו מדדי תוצאה כמותיים וברורים, מנגנון ביקורת עצמאי, ולוחות זמנים לדיווח והערכה.",
      },
      {
        criterionId: "reporting",
        terms: ["דיווח", "פרסום", "דוח", "עדכון", "מידע", "שקיפות", "חשיפה", "פרטים"],
        patterns: ["דיווח\\s+[א-ת]+", "דוח\\s+[א-ת]+", "פרסום\\s+[א-ת]+"],
        explanation: "נדרש מנגנון דיווח שקוף ומובנה.",
        suggestion: "הקימו מערכת דיווח סדירה עם פורמט אחיד, תדירות קבועה ופרסום פתוח לציבור.",
      },
      {
        criterionId: "external_audit",
        terms: ["ביקורת חיצונית", "מבקר", "אישור", "וידוא", "פיקוח", "בקרה", "ביקורת"],
        patterns: ["מבקר\\s+[א-ת]+", "ביקורת\\s+[א-ת]+", "פיקוח\\s+[א-ת]+"],
        explanation: "נדרשת ביקורת חיצונית עצמאית ומקצועית.",
        suggestion: "מנו גורם ביקורת חיצוני מוסמך, קבעו תדירות בדיקות וחובת פרסום ממצאים.",
      },
      {
        criterionId: "multi_levels",
        terms: ["רמות", "דרגים", "היררכיה", "מנהלים", "פקידים", "בכירים", "זוטרים", "תיאום"],
        patterns: ["רמת\\s+[א-ת]+", "דרג\\s+[א-ת]+", "מנהל\\s+[א-ת]+"],
        explanation: "נדרש תיאום יעיל בין הרמות הארגוניות השונות.",
        suggestion: "הבהירו את חלוקת האחריות בין הדרגים וצרו מנגנוני תיאום ותקשורת ברורים.",
      },
      {
        criterionId: "structure",
        terms: ["מבנה", "ארגון", "חלוקה", "תפקידים", "אחריות", "סמכות", "היררכיה", "מנהל פרויקט"],
        patterns: ["מנהל\\s+[א-ת]+", "אחראי\\s+[א-ת]+", "צוות\\s+[א-ת]+"],
        explanation: "נדרש מבנה ארגוני ברור עם הגדרת תפקידים.",
        suggestion: "חלקו את התוכנית למשימות ספציפיות עם בעלי תפקידים מוגדרים, סמכויות ברורות ואבני דרך.",
      },
      {
        criterionId: "field_implementation",
        terms: ["יישום", "ביצוע", "שטח", "מבצעים", "הפעלה", "הטמעה", "מימוש", "יישום בפועל"],
        patterns: ["יישום\\s+[א-ת]+", "ביצוע\\s+[א-ת]+", "הטמעה\\s+[א-ת]+"],
        explanation: "נדרש תיאור מפורט של היישום בפועל בשטח.",
        suggestion: "פרטו את תהליכי היישום בשטח: מי מבצע, איך, באילו כלים וסמכויות, ומה מנגנון הפיקוח.",
      },
      {
        criterionId: "arbitrator",
        terms: ["מכריע", "החלטה", "פתרון סכסוכים", "בוררות", "הכרעה", "סמכות הכרעה"],
        patterns: ["גורם מכריע", "סמכות\\s+[א-ת]+", "הכרעה\\s+[א-ת]+"],
        explanation: "נדרש מנגנון הכרעה לקבלת החלטות ופתרון חסימות.",
        suggestion: "מנו גורם מכריע עם סמכות ברורה, זמן תגובה מוגדר ונהלי הסלמה למקרים מורכבים.",
      },
      {
        criterionId: "outcomes",
        terms: ["תוצאות", "השגים", "מטרות", "יעדים", "הישגים", "פלט", "תפוקה", "השפעה"],
        patterns: ["יעד\\s+[א-ת]+", "מטרה\\s+[א-ת]+", "תוצאה\\s+[א-ת]+"],
        explanation: "נדרשת הגדרה ברורה של התוצאות הצפויות והמדידות.",
        suggestion: "הגדירו מדדי תוצאה ברורים וניתנים למדידה, יעדי הצלחה כמותיים ומערכת מעקב אחר השגתם.",
      },
      {
        criterionId: "integrator",
        terms: ["מתאם", "מתכלל", "מנהל", "רכז", "מרכז", "תיאום", "אינטגרציה", "מטה"],
        patterns: ["מנהל\\s+[א-ת]+", "מתאם\\s+[א-ת]+", "צוות מתכלל"],
        explanation: "נדרש גורם מתכלל לתיאום וניהול התוכנית.",
        suggestion: "הגדירו צוות מתכלל עם הרכב מוגדר, סמכויות ברורות ותדירות ישיבות קבועה לתיאום.",
      },
    ];
    
    const insights = [];
    const foundMatches = new Set(); // Avoid duplicates
    
    for (const rule of rules) {
      // Check terms
      for (const term of rule.terms) {
        const index = content.indexOf(term);
        if (index >= 0 && insights.length < maxInsights) {
          const matchKey = `${rule.criterionId}-${index}-${term}`;
          if (!foundMatches.has(matchKey)) {
            foundMatches.add(matchKey);
            insights.push({
              id: `local-${rule.criterionId}-${index}`,
              criterionId: rule.criterionId,
              quote: content.slice(Math.max(0, index - 30), Math.min(content.length, index + term.length + 30)),
              explanation: rule.explanation,
              suggestion: rule.suggestion,
              suggestion_primary: rule.suggestion,
              suggestion_secondary: `נדרש פיתוח והעמקה של הסעיף ${rule.criterionId} עם פירוט נוסף ומדדים מותאמים`,
              rangeStart: index,
              rangeEnd: index + term.length,
            });
          }
        }
      }
      
      // Check regex patterns if defined
      if (rule.patterns && insights.length < maxInsights) {
        for (const pattern of rule.patterns) {
          try {
            const regex = new RegExp(pattern, 'g');
            let match;
            while ((match = regex.exec(content)) !== null && insights.length < maxInsights) {
              const matchKey = `${rule.criterionId}-${match.index}-pattern`;
              if (!foundMatches.has(matchKey)) {
                foundMatches.add(matchKey);
                insights.push({
                  id: `local-${rule.criterionId}-pattern-${match.index}`,
                  criterionId: rule.criterionId,
                  quote: content.slice(Math.max(0, match.index - 30), Math.min(content.length, match.index + match[0].length + 30)),
                  explanation: `${rule.explanation} נמצא דפוס: "${match[0]}"`,
                  suggestion: rule.suggestion,
                  suggestion_primary: rule.suggestion,
                  suggestion_secondary: `התמקדו בפיתוח הדפוס "${match[0]}" ובהרחבת ההיבטים הקשורים`,
                  rangeStart: match.index,
                  rangeEnd: match.index + match[0].length,
                });
              }
            }
          } catch (e) {
            // Skip invalid regex patterns
            if (env.features.debugLogging) {
              console.warn(`Invalid regex pattern: ${pattern}`, e);
            }
          }
        }
      }
    }
    
    return {
      insights: insights.slice(0, maxInsights),
      criteria: [],
      summary: {
        feasibilityPercent: 65,
        feasibilityLevel: 'medium' as const,
        reasoning: 'ניתוח מקומי בסיסי - נדרש ניתוח מתקדם יותר'
      },
      meta: {
        source: 'local' as const,
        version: 'local-router-v1.0'
      }
    };
  }
}

// Factory function to create router instance with Supabase client
export function createFunctionRouter(supabaseClient?: any): FunctionRouter {
  return new FunctionRouter(supabaseClient);
}

// Default instance for legacy compatibility (will use local functions URL only)
export const functionRouter = new FunctionRouter();

// Export for backward compatibility
export { functionRouter as router };