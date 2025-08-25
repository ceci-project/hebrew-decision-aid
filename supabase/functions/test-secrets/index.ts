import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('test-secrets function started');

  try {
    // Get all environment variables
    const allEnv = Deno.env.toObject();
    
    // Check for all possible OpenAI secret names
    const openAISecrets = {
      OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
      OPENAI_API_KEY_SECRET: Deno.env.get('OPENAI_API_KEY_SECRET'),
      openai_api_key: Deno.env.get('openai_api_key'),
      OPENAI_PROJECT_ID: Deno.env.get('OPENAI_PROJECT_ID'),
    };

    // Check for assistant secrets
    const assistantSecrets = {
      ASSISTANT_ID: Deno.env.get('ASSISTANT_ID'),
      ASSISTANT_ID_SECRET: Deno.env.get('ASSISTANT_ID_SECRET'),
      assistant_id: Deno.env.get('assistant_id'),
    };

    const response = {
      totalEnvVars: Object.keys(allEnv).length,
      allEnvKeys: Object.keys(allEnv),
      openAISecrets: Object.entries(openAISecrets).map(([key, value]) => ({
        key,
        exists: !!value,
        length: value ? value.length : 0,
        preview: value ? `${value.substring(0, 8)}...` : null
      })),
      assistantSecrets: Object.entries(assistantSecrets).map(([key, value]) => ({
        key,
        exists: !!value,
        length: value ? value.length : 0,
        preview: value ? `${value.substring(0, 8)}...` : null
      })),
      timestamp: new Date().toISOString()
    };

    console.log('Secrets test result:', response);

    return new Response(JSON.stringify(response, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in test-secrets function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});