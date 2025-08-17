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

  try {
    // Test secrets
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const assistantId = Deno.env.get('ASSISTANT_ID');
    
    console.log('TEST SECRETS CHECK:', {
      hasOpenaiKey: !!openAIApiKey,
      openaiKeyLength: openAIApiKey?.length || 0,
      openaiKeyStart: openAIApiKey?.substring(0, 10) || 'UNDEFINED',
      hasAssistantId: !!assistantId,
      assistantIdLength: assistantId?.length || 0,
      assistantIdValue: assistantId || 'UNDEFINED'
    });

    return new Response(
      JSON.stringify({
        success: true,
        secrets: {
          hasOpenaiKey: !!openAIApiKey,
          openaiKeyLength: openAIApiKey?.length || 0,
          openaiKeyStart: openAIApiKey?.substring(0, 10) || 'UNDEFINED',
          hasAssistantId: !!assistantId,
          assistantIdLength: assistantId?.length || 0,
          assistantIdValue: assistantId || 'UNDEFINED'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-secrets:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});